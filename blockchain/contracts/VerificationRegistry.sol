// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerificationRegistry {
    event TransactionVerified(
        string indexed appTxId,
        bytes32 indexed payloadHash,
        address indexed publisher,
        uint256 timestamp
    );

    function recordVerification(string calldata appTxId, bytes32 payloadHash) external {
        emit TransactionVerified(appTxId, payloadHash, msg.sender, block.timestamp);
    }
}
