// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BeggingContract is Ownable {
    mapping(address => uint256) private balances;
    uint256 public totalDonations;

    constructor() Ownable(msg.sender) {}

    function donate() public payable {
        balances[msg.sender] += msg.value;
        totalDonations += msg.value;
    }

    function withDraw() public payable onlyOwner {
        require(totalDonations > 0);
        payable(msg.sender).transfer(totalDonations);
        totalDonations = 0;
    }

    function getDonation(address account) public view returns(uint256) {
        return balances[account];
    }
}