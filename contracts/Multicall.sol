// SPDX-License-Identifier: do-not-steal-it

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./FlashLoanReceiverBase.sol";
import "hardhat/console.sol";

interface IV2Pool {
    function getReserves()
        external
        view
        returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        );

    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;
}

interface IV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);

    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
}

// interface IERC20 {
//     function balanceOf(address account) external view returns (uint256);

//     function transfer(address recipient, uint256 amount)
//         external
//         returns (bool);

//     function approve(address spender, uint256 amount) external returns (bool);
// }

interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256) external;
}

contract Multicall is FlashLoanReceiverBase {
    using SafeERC20 for address;

    IWETH private immutable WETH;
    address payable private immutable owner;
    address private immutable executor;
    address private immutable v3Factory;

    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO =
        1461446703485210103287273052203988822378723970342;
    bytes32 internal constant POOL_INIT_CODE_HASH =
        0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor(
        address _executor,
        IPoolAddressesProvider _poolAddressesProvider,
        address _WETH,
        address _v3Factory
    ) payable FlashLoanReceiverBase(_poolAddressesProvider) {
        owner = payable(msg.sender);
        WETH = IWETH(_WETH);
        executor = _executor;
        v3Factory = _v3Factory;
        if (msg.value > 0) {
            WETH.deposit{value: msg.value}();
        }
    }

    function multicall(
        uint256 _wethInputAmount,
        uint24 _coinbaseShare,
        uint8[] calldata _types,
        bytes[] calldata _swaps
    ) external onlyOwner returns (bool) {
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes = new uint256[](1);
        assets[0] = address(WETH);
        amounts[0] = _wethInputAmount;
        modes[0] = 0;
        bytes memory params = abi.encode(_coinbaseShare, _types, _swaps);

        lendingPool.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            0
        );

        return true;
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(initiator == address(this));
        require(msg.sender == address(lendingPool));
        (uint24 coinbaseShare, , ) = abi.decode(
            params,
            (uint24, uint8[], bytes[])
        );

        uint256 wethBefore = WETH.balanceOf(address(this));
        loopSwaps(amounts[0], params);
        uint256 wethAfter = WETH.balanceOf(address(this));

        console.log(wethAfter, "wethAfter");

        require(wethAfter > (wethBefore * 80) / 100, "NUKE");
        require(wethAfter > wethBefore + premiums[0], "NP");

        WETH.approve(address(lendingPool), amounts[0] + premiums[0]);

        // if (coinbaseShare > 0) {
        //     uint256 profit = wethAfter - wethBefore - premiums[0];
        //     uint256 share = (profit * coinbaseShare) / 1000;
        //     WETH.withdraw(share);
        //     block.coinbase.transfer(share);
        // }

        return true;
    }

    function call(
        address payable _to,
        uint256 _value,
        bytes calldata _data
    ) external payable onlyOwner returns (bytes memory) {
        require(_to != address(0));
        (bool _success, bytes memory _result) = _to.call{value: _value}(_data);
        require(_success);
        return _result;
    }

    function loopSwaps(uint256 nextAmountIn, bytes calldata params) internal {
        (, uint8[] memory types, bytes[] memory swaps) = abi.decode(
            params,
            (uint256, uint8[], bytes[])
        );

        for (uint256 i = 0; i < types.length; i++) {
            console.log(nextAmountIn);

            if (types[i] == 2) {
                (, address _tokenIn, address _tokenOut, address _pool) = abi
                    .decode(swaps[i], (uint256, address, address, address));

                nextAmountIn = exactInputV2(
                    nextAmountIn,
                    _tokenIn,
                    _tokenOut,
                    IV2Pool(_pool)
                );
            } else if (types[i] == 3) {
                (
                    ,
                    address _tokenIn,
                    address _tokenOut,
                    uint24 _fee,
                    address _pool
                ) = abi.decode(
                        swaps[i],
                        (uint256, address, address, uint24, address)
                    );
                nextAmountIn = exactInputV3(
                    int256(nextAmountIn),
                    _tokenIn,
                    _tokenOut,
                    _fee,
                    IV3Pool(_pool)
                );
            }
        }
    }

    function exactInputV2(
        uint256 _amountIn,
        address _tokenIn,
        address _tokenOut,
        IV2Pool _pool
    ) internal virtual returns (uint256 amountOut) {
        amountOut = v2AmountOut(_amountIn, _pool, _tokenIn < _tokenOut);
        SafeERC20.safeTransfer(IERC20(_tokenIn), address(_pool), _amountIn);
        (uint256 amount0Out, uint256 amount1Out) = _tokenIn < _tokenOut
            ? (uint256(0), amountOut)
            : (amountOut, uint256(0));
        _pool.swap(amount0Out, amount1Out, address(this), new bytes(0));
        return amountOut;
    }

    function exactInputV3(
        int256 _amountIn,
        address _tokenIn,
        address _tokenOut,
        uint24 _fee,
        IV3Pool _pool
    ) internal returns (uint256 amountOut) {
        bool zeroForOne = _tokenIn < _tokenOut;
        bytes memory data = abi.encode(_tokenIn, _tokenOut, _fee, zeroForOne);

        (int256 amount0, int256 amount1) = _pool.swap(
            address(this),
            zeroForOne,
            _amountIn,
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            data
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata _data
    ) external {
        (address tokenIn, address tokenOut, uint24 fee, bool zeroForOne) = abi
            .decode(_data, (address, address, uint24, bool));

        (address token0, address token1) = zeroForOne
            ? (tokenIn, tokenOut)
            : (tokenOut, tokenIn);

        validateV3Pool(token0, token1, fee);

        uint256 amountToPay = tokenIn < tokenOut
            ? uint256(amount0Delta)
            : uint256(amount1Delta);
        SafeERC20.safeTransfer(IERC20(tokenIn), msg.sender, amountToPay);
    }

    function v2AmountOut(
        uint256 _amountIn,
        IV2Pool _pool,
        bool _zeroForOne
    ) internal view returns (uint256) {
        (uint256 reserve0, uint256 reserve1, ) = _pool.getReserves();
        (uint256 reserveIn, uint256 reserveOut) = _zeroForOne
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
        uint256 amountInWithFee = _amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    function validateV3Pool(
        address _token0,
        address _token1,
        uint24 _fee
    ) internal view {
        address pool = address(
            bytes20(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                hex"ff",
                                v3Factory,
                                keccak256(abi.encode(_token0, _token1, _fee)),
                                POOL_INIT_CODE_HASH
                            )
                        )
                    )
                )
            )
        );
        require(msg.sender == pool);
    }

    function killswitch() external onlyOwner {
        selfdestruct(owner);
    }
}
