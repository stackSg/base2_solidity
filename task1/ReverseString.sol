// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

contract Reverse {
    function reverseString(string memory str) public pure returns(string memory) {
        bytes memory arr = bytes(str);
        uint len = arr.length;
        for (uint i = 0; i < len / 2; i++) {
            bytes1 tmp = arr[i];
            arr[i] = arr[len - 1 - i];
            arr[len - i - 1] = tmp;
        }
        return string(arr);
    }
}