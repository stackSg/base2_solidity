// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

contract BinarySearch{
    function search(int[] memory nums, int target) public pure returns (int) {
        uint256 i = 0;
        uint256 j = nums.length - 1;
        while (i <= j) {
            uint256 mid = i + (j - i) / 2;
            if (nums[mid] == target) {
                return int(mid);
            } else if (nums[mid] > target) {
                j = mid - 1;
            } else {
                i = mid + 1;
            }
        }
        
        return -1;
    }
}