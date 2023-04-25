// SPDX-License-Identifier: do-not-steal-it
pragma solidity ^0.8.0;

interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

interface IPoolAddressesProvider {
    function getLendingPool() external view returns (address);
}

interface ILendingPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {
    IPoolAddressesProvider internal addressesProvider;
    ILendingPool internal lendingPool;

    constructor(IPoolAddressesProvider _provider) {
        addressesProvider = _provider;
        lendingPool = ILendingPool(
            IPoolAddressesProvider(_provider).getLendingPool()
        );
    }

    function ADDRESSES_PROVIDER()
        external
        view
        returns (IPoolAddressesProvider)
    {
        return addressesProvider;
    }

    receive() external payable {}
}
