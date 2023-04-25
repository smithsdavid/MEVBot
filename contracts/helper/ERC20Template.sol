// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Template is ERC20 {
    uint8 private dec;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        dec = _decimals;
        _mint(msg.sender, type(uint256).max);
    }

    function decimals() public view override returns (uint8) {
        return dec;
    }
}
