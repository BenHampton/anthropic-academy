Goal:
Our prompt needs to assist users in writing three specific types of output for AWS use cases:

Python code
JSON configuration files
Regular expressions

Evaluation Criteria:

Format - Should return only Python, JSON, or Regex without explanation

Valid Syntax - Produced code should have valid syntax

Task Following - Response should directly address the user's task with accurate code


Code Based Grading:

Steps:
1: Add functions to validate JSON/Python/Regex
2: Make sure our dataset test case indicates the type of generated content (JSON, Python or Regex)
3: Update our draft prompt to make it clear we only want the relevant JSON/Python/Regex
4: Merge the scores from the model grader and the coder grader

Format - The response should return only the requested code type (Python, JSON, or Regex) without explanations

Valid Syntax - The generated code should actually parse correctly as the intended language

Task Following - The response should directly address what was asked and be accurate


