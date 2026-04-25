Goal:
We're going to build a practical project that teaches Claude how to set reminders for future dates. This might sound simple at first, but it reveals several interesting challenges that we'll solve using custom tools.

We'll create three separate tools to handle each challenge:
1. Get the current date time: 
    - Claude needs to know the current date and time precisely
2. Add duration to date time: 
    - Claude isn't perfect with date time addition, so we'll give it a reliable tool for this
3. Set a reminder:
    - We need a way to actually set a reminder in the system
