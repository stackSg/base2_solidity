// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

contract Voting {
    mapping(string=>uint) votingMap;
    string[] public cadidates;

    function vote(string memory cadidateName) public {
        if (votingMap[cadidateName] == 0) cadidates.push(cadidateName);
        votingMap[cadidateName]++;
    }

    function getVotes(string memory cadidateName) public view returns(uint){
        return votingMap[cadidateName];
    }

    function resetVotes() public {
        for (uint i = 0; i < cadidates.length; i++) {
            votingMap[cadidates[i]] = 0;
        }
        delete cadidates;
    }
}