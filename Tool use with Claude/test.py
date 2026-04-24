import unittest
import math
from main import calculate_pi


class TestPiCalculation(unittest.TestCase):
    """Test cases for the calculate_pi function"""
    
    def test_pi_5_digits(self):
        """Test that pi is calculated to 5 decimal places accurately"""
        calculated_pi = calculate_pi(5)
        # Pi to 5 decimal places is 3.14159
        self.assertAlmostEqual(calculated_pi, math.pi, places=5)
    
    def test_pi_value_range(self):
        """Test that calculated pi is in the expected range"""
        calculated_pi = calculate_pi(5)
        # Pi should be between 3.14159 and 3.14160
        self.assertGreater(calculated_pi, 3.14159)
        self.assertLess(calculated_pi, 3.14160)
    
    def test_pi_first_5_digits(self):
        """Test that the first 5 decimal digits match pi exactly"""
        calculated_pi = calculate_pi(5)
        # Round to 5 decimal places
        rounded_pi = round(calculated_pi, 5)
        expected_pi = 3.14159
        self.assertEqual(rounded_pi, expected_pi)
    
    def test_pi_different_precisions(self):
        """Test calculation with different precision levels"""
        pi_3 = calculate_pi(3)
        pi_5 = calculate_pi(5)
        pi_10 = calculate_pi(10)
        
        # All should be close to the actual value of pi
        self.assertAlmostEqual(pi_3, math.pi, places=3)
        self.assertAlmostEqual(pi_5, math.pi, places=5)
        self.assertAlmostEqual(pi_10, math.pi, places=10)
    
    def test_pi_string_representation(self):
        """Test that the string representation starts with 3.14159"""
        calculated_pi = calculate_pi(5)
        pi_str = f"{calculated_pi:.5f}"
        self.assertTrue(pi_str.startswith("3.14159"))


if __name__ == "__main__":
    # Run the tests
    print("Testing pi calculation function...")
    print(f"Calculated pi (5 digits): {calculate_pi(5)}")
    print(f"Actual value of pi:       {math.pi}")
    print(f"Difference:               {abs(calculate_pi(5) - math.pi)}")
    print("\n" + "="*60 + "\n")
    
    unittest.main()
