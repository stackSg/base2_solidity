// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

contract Roman {
    uint256[] private a = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    string[] private b = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];


    function intToRoman(uint256 num) public view returns (string memory) {
        string memory result = "";
        for (uint256 i = 0; i < a.length; i++) {
            while (num >= a[i]) {
                num -= a[i];
                result = string.concat(result, b[i]);
            }
        }
        return result;
    }

    mapping(string=>uint) private romanToIntMap;

    constructor() {
        for (uint256 i = 0; i < a.length; i++) {
            romanToIntMap[b[i]] = a[i];
        }
    }

    function romanToInt(string calldata s) public view returns (uint) {
        uint res = 0;
        uint i = 0;
        bytes calldata arr = bytes(s);
        while (i < arr.length) {
            if (i + 1 < arr.length && romanToIntMap[string(arr[i:i+2])] > 0) {
                res += romanToIntMap[string(arr[i:i+2])];
                i += 2;
            } else {
                res += romanToIntMap[string(arr[i:i+1])];
                i++;
            }
        }
        return res;
    }
}