// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

contract MyERC20 {
    mapping(address=>uint256) private balance;
    mapping(address=>mapping(address=>uint256)) private allowance;
    address public owner = msg.sender;

    event Transfer(address indexed from, address indexed to, uint256 amount);

    event Approval(address indexed from, address indexed sender, uint256 amount);

    function balanceOf(address user) public view returns(uint256) {
        return balance[user];
    }

    function transfer(address to, uint256 amount) public {
        _transfer(msg.sender, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal  {
        require(to != address(0), "to address is invalid");
        require(balance[from]>=amount, "Not enough tokens");
        balance[from]-=amount;
        balance[to]+=amount;
        emit Transfer(from, to, amount);
    }

    function approve(address spender, uint256 amount) public {
        allowance[msg.sender][spender]=amount;
        emit Approval(msg.sender, spender, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public {
        uint256 allowanceAmount = allowance[from][msg.sender];
        require(allowanceAmount>=amount, "Not enough allowance");
        allowance[from][msg.sender] = allowanceAmount - amount;
        emit Approval(from, msg.sender, amount);
        _transfer(from, to, amount);
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == owner, "Not allowed");
        balance[to]+=amount;
        emit Transfer(address(0), to, amount);
    }
}