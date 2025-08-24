// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

contract MergeSortedArray {
    function merge(uint[] calldata arr1, uint[] calldata arr2) public pure returns (uint[] memory) {
        uint[] memory merged = new uint[](arr1.length + arr2.length);
        uint i = 0;
        uint j = 0;
        uint k = 0;
        
        while (i < arr1.length && j < arr2.length) {
            if (arr1[i] < arr2[j]) {
                merged[k++] = arr1[i++];
            } else {
                merged[k++] = arr2[j++];
            }
        }
        while (i < arr1.length) merged[k++] = arr1[i++];
        while (j < arr2.length) merged[k++] = arr2[j++];
        return merged;
    }
}