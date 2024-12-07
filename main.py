import pyautogui
import time
import random
import string


def random_string(length):
    """Generate a random string of given length."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


try:
    while True:
        # Move mouse up
        pyautogui.move(0, -50, duration=0.5)  # Move mouse 50 pixels up

        # Click and type random string
        pyautogui.click()
        random_text = random_string(random.randint(10, 18))
        pyautogui.typewrite(random_text, interval=0.1)

        # Pause
        time.sleep(1)

        # Delete the string
        pyautogui.typewrite(["backspace"] * len(random_text), interval=0.05)

        # Move mouse down
        pyautogui.move(0, 50, duration=0.5)  # Move mouse 50 pixels down

        # Pause before next loop
        time.sleep(1)

except KeyboardInterrupt
    print("Script terminated by user.")
