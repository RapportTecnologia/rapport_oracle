// SPDX-License-Identifier: CC-BY-SA-4.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RapportOracle} from "../../contracts/evm/RapportOracle.sol";

//
//  Author:   Carlos Delfino
//  Email:    consultoria@carlosdelfino.eti.br
//  WhatsApp: +55 (85) 98520-5490
//

/**
 * @title RapportOracleTest (Foundry)
 * @notice Fuzz + invariant do conector RapportOracle.
 * @dev REQ-EVM-01/02: unicidade de queryId e cobrança de taxa sob fuzzing.
 *
 */
contract RapportOracleTest is Test {
    RapportOracle internal oracle;
    address internal relayer = address(0xBEEF);
    address internal consumer = address(0xCAFE);

    function setUp() public {
        oracle = new RapportOracle(relayer);
    }

    function test_QueryEmitsAndReturnsId() public {
        vm.prank(consumer);
        bytes32 rqid = oracle.query(0, "URL", "json(x).USD");
        assertTrue(rqid != bytes32(0));
    }

    function testFuzz_QueryIdsAreUnique(string memory a, string memory b) public {
        vm.assume(keccak256(bytes(a)) != keccak256(bytes(b)));
        vm.startPrank(consumer);
        bytes32 r1 = oracle.query(0, "URL", a);
        bytes32 r2 = oracle.query(0, "URL", b);
        vm.stopPrank();
        assertTrue(r1 != r2);
    }

    function testFuzz_FeeCharged(uint256 fee) public {
        fee = bound(fee, 0, 10 ether);
        oracle.setBaseFee(fee);
        assertEq(oracle.getPrice("URL"), fee);
        vm.deal(consumer, fee + 1 ether);
        if (fee > 0) {
            vm.prank(consumer);
            vm.expectRevert(
                abi.encodeWithSelector(RapportOracle.RapportOracle__InsufficientFee.selector, fee, fee - 1)
            );
            oracle.query{value: fee - 1}(0, "URL", "x");
        }
        vm.prank(consumer);
        bytes32 rqid = oracle.query{value: fee}(0, "URL", "x");
        assertTrue(rqid != bytes32(0));
        assertEq(address(oracle).balance, fee);
    }

    function test_RevertWhenEmptyArgsArray() public {
        string[] memory empty = new string[](0);
        vm.prank(consumer);
        vm.expectRevert(RapportOracle.RapportOracle__EmptyArgs.selector);
        oracle.query(0, "URL", empty);
    }

    function test_OnlyOwnerSetsFee(address notOwner) public {
        vm.assume(notOwner != address(this));
        vm.prank(notOwner);
        vm.expectRevert(RapportOracle.RapportOracle__NotOwner.selector);
        oracle.setBaseFee(1);
    }
}
