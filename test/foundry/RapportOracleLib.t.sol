// SPDX-License-Identifier: CC-BY-SA-4.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestUsingRapportOracle} from "../../contracts/evm/mocks/TestUsingRapportOracle.sol";

//
//  Author:   Carlos Delfino
//  Email:    consultoria@carlosdelfino.eti.br
//  WhatsApp: +55 (85) 98520-5490
//

/**
 * @title RapportOracleLibTest (Foundry)
 * @notice Fuzzing dos helpers da biblioteca usingRapportOracle.
 * @dev REQ-LIB-01: parseInt/uint2str/strConcat/indexOf/substring sob fuzz.
 *
 */
contract RapportOracleLibTest is Test {
    TestUsingRapportOracle internal lib;

    function setUp() public {
        lib = new TestUsingRapportOracle(address(0));
    }

    function test_ParseIntDecimals() public {
        assertEq(lib.exposedParseIntDecimals("3123.45", 2), 312345);
        assertEq(lib.exposedParseIntDecimals("0.001", 3), 1);
        assertEq(lib.exposedParseIntDecimals("999", 0), 999);
        assertEq(lib.exposedParseIntDecimals("10", 4), 100000);
    }

    function testFuzz_ParseIntRoundtrip(uint256 x) public {
        string memory s = lib.exposedUint2str(x);
        assertEq(lib.exposedParseInt(s), x);
    }

    function testFuzz_StrConcatPrefix(string memory a, string memory b) public {
        string memory c = lib.exposedStrConcat(a, b);
        assertEq(bytes(c).length, bytes(a).length + bytes(b).length);
        // indexOf do prefixo a dentro de a||b deve ser 0 quando a nao vazio
        if (bytes(a).length > 0) {
            assertEq(lib.exposedIndexOf(c, a), 0);
        }
    }

    function test_Strcmp() public {
        assertTrue(lib.exposedStrcmp("URL", "URL"));
        assertFalse(lib.exposedStrcmp("URL", "url"));
    }

    function test_ParseTimestamp() public {
        assertEq(lib.exposedParseTimestamp("1970-01-01T00:00:00Z"), 0);
        assertEq(lib.exposedParseTimestamp("2021-09-16T00:00:00Z"), 1631750400);
        assertEq(lib.exposedParseTimestamp("2000-02-29T12:30:45Z"), 951827445);
    }

    function test_RevertWhenTimestampShort() public {
        vm.expectRevert("RapportOracle: timestamp too short");
        lib.exposedParseTimestamp("2021-09-16");
    }

    function test_IndexOfMissing() public {
        assertEq(lib.exposedIndexOf("abcdef", "gh"), -1);
        assertEq(lib.exposedIndexOf("", "x"), -1);
        assertEq(lib.exposedIndexOf("ab", "abc"), -1);
    }
}
