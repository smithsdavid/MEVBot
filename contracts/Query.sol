// SPDX-License-Identifier: unlicensed

pragma solidity ^0.7.6;

import "hardhat/console.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract Query {
    function getSqrtsAndReservesByPairs(
        IUniswapV2Pair[] calldata _pairsV2,
        IUniswapV3Pool[] calldata _pairsV3
    )
        external
        view
        returns (
            uint256[3][] memory,
            uint256[2][] memory,
            uint256[2][] memory
        )
    {
        uint256[3][] memory reservesV2 = new uint256[3][](_pairsV2.length);
        uint256[2][] memory sqrtsV3 = new uint256[2][](_pairsV3.length);
        uint256[2][] memory reservesV3 = new uint256[2][](_pairsV3.length);

        for (uint256 i = 0; i < _pairsV2.length; i++) {
            (reservesV2[i][0], reservesV2[i][1], reservesV2[i][2]) = _pairsV2[i]
                .getReserves();
        }

        for (uint256 i = 0; i < _pairsV3.length; i++) {
            (sqrtsV3[i][0], , , , , , ) = _pairsV3[i].slot0();
            sqrtsV3[i][1] = block.timestamp;
        }

        for (uint256 i = 0; i < _pairsV3.length; i++) {
            uint256 reserve0 = IERC20(_pairsV3[i].token0()).balanceOf(
                address(_pairsV3[i])
            );

            uint256 reserve1 = IERC20(_pairsV3[i].token1()).balanceOf(
                address(_pairsV3[i])
            );
            reservesV3[i][0] = reserve0;
            reservesV3[i][1] = reserve1;
        }

        return (reservesV2, sqrtsV3, reservesV3);
    }

    function oracleV3(
        address _pool,
        address tokenIn,
        address tokenOut,
        uint128 amountIn
    ) external view returns (uint256) {
        IUniswapV3Pool pool = IUniswapV3Pool(_pool);
        uint256 amountOut = estimateAmountOut(
            _pool,
            amountIn,
            tokenIn,
            tokenOut
        );
        console.log("amountOut", amountOut);
        return amountOut;
    }

    function estimateAmountOut(
        address _pool,
        uint128 _amountIn,
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256) {
        IUniswapV3Pool pool = IUniswapV3Pool(_pool);
        uint32 secondsAgo = 1;
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        // (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(
        //     secondsAgos
        // );

        // int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        // int24 tick = int24(tickCumulativesDelta / secondsAgo);
        // if (
        //     tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgo != 0)
        // ) tick--;

        (, int24 tick, , , , , ) = pool.slot0();
        uint256 amountOut = OracleLibrary.getQuoteAtTick(
            tick,
            _amountIn,
            tokenIn,
            tokenOut
        );

        return amountOut;
    }
}
