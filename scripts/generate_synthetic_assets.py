import os
from PIL import Image, ImageDraw, ImageFont

def create_question_paper(path):
    # Standard A4-like image dimensions (800 x 1100)
    width, height = 800, 1100
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Draw border
    draw.rectangle([(20, 20), (width - 20, height - 20)], outline=(40, 40, 40), width=2)
    draw.line([(20, 110), (width - 20, 110)], fill=(40, 40, 40), width=2)

    # Title & Header
    draw.text((width // 2 - 170, 35), "PHYSICS — INTERNAL ASSESSMENT", fill=(10, 30, 80))
    draw.text((width // 2 - 100, 65), "Class X - Mid Term Examination", fill=(60, 60, 60))
    draw.text((40, 85), "Time: 40 min", fill=(0, 0, 0))
    draw.text((width - 160, 85), "Max Marks: 10", fill=(0, 0, 0))

    # Instructions
    draw.text((40, 130), "General Instructions: Answer all questions clearly. Show detailed steps for numericals.", fill=(80, 80, 80))
    draw.line([(40, 150), (width - 40, 150)], fill=(200, 200, 200), width=1)

    # Question 1
    draw.text((40, 180), "Q1. (a) State Newton's second law of motion.", fill=(0, 0, 0))
    draw.text((70, 210), "(b) Write its mathematical expression in terms of force, mass, and acceleration.", fill=(0, 0, 0))
    draw.text((width - 120, 180), "[3 Marks]", fill=(120, 20, 20))

    # Question 2
    draw.text((40, 290), "Q2. A car accelerates uniformly from rest to a speed of 20 m/s in 5 seconds.", fill=(0, 0, 0))
    draw.text((70, 320), "(a) Calculate the acceleration of the car.", fill=(0, 0, 0))
    draw.text((70, 350), "(b) Calculate the total distance covered by the car during this time.", fill=(0, 0, 0))
    draw.text((width - 120, 290), "[4 Marks]", fill=(120, 20, 20))

    # Question 3
    draw.text((40, 430), "Q3. State the law of conservation of energy and give one real-world example", fill=(0, 0, 0))
    draw.text((70, 460), "illustrating the transformation of potential energy into kinetic energy.", fill=(0, 0, 0))
    draw.text((width - 120, 430), "[3 Marks]", fill=(120, 20, 20))

    # Footer line
    draw.line([(40, 1020), (width - 40, 1020)], fill=(200, 200, 200), width=1)
    draw.text((width // 2 - 60, 1040), "--- END OF PAPER ---", fill=(100, 100, 100))

    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, format="PNG")
    print(f"Saved Question Paper to {path}")

def create_answer_script(path):
    width, height = 800, 1100
    img = Image.new("RGB", (width, height), color=(253, 252, 245)) # slightly off-white paper
    draw = ImageDraw.Draw(img)

    # Draw notebook lines
    draw.line([(70, 0), (70, height)], fill=(230, 160, 160), width=2) # margin line
    for y in range(80, height - 40, 32):
        draw.line([(0, y), (width, y)], fill=(220, 230, 242), width=1)

    # Header handwritten style info
    draw.text((85, 45), "Student Name: Alex Smith    Roll No: 104    Subject: Physics", fill=(15, 25, 120))
    draw.line([(85, 75), (width - 40, 75)], fill=(15, 25, 120), width=1)

    # Answer 1
    draw.text((20, 90), "Ans 1", fill=(20, 20, 160))
    draw.text((85, 90), "Newton's Second Law of Motion states that the rate of change of momentum", fill=(10, 10, 140))
    draw.text((85, 122), "of a body is directly proportional to the applied unbalanced force,", fill=(10, 10, 140))
    draw.text((85, 154), "and takes place in the direction of the force.", fill=(10, 10, 140))
    draw.text((85, 186), "Mathematical formula:  F = m * a", fill=(10, 10, 140))
    draw.text((85, 218), "where F = Force, m = Mass, a = Acceleration.", fill=(10, 10, 140))

    # Answer 2
    draw.text((20, 282), "Ans 2", fill=(20, 20, 160))
    draw.text((85, 282), "Given: Initial velocity (u) = 0 m/s, Final velocity (v) = 20 m/s", fill=(10, 10, 140))
    draw.text((85, 314), "Time taken (t) = 5 s", fill=(10, 10, 140))
    draw.text((85, 346), "(a) Acceleration (a) = (v - u) / t", fill=(10, 10, 140))
    draw.text((120, 378), "= (20 - 0) / 5 = 4 m/s²", fill=(10, 10, 140))
    draw.text((85, 410), "(b) Distance (s) = u*t + (1/2)*a*t²", fill=(10, 10, 140))
    draw.text((120, 442), "= 0*5 + (1/2) * 4 * (5²)", fill=(10, 10, 140))
    draw.text((120, 474), "= 0 + 2 * 25 = 50 meters.", fill=(10, 10, 140))

    # Answer 3
    draw.text((20, 538), "Ans 3", fill=(20, 20, 160))
    draw.text((85, 538), "Law of Conservation of Energy: Energy can neither be created nor destroyed;", fill=(10, 10, 140))
    draw.text((85, 570), "it can only be transformed from one form to another. Total energy remains constant.", fill=(10, 10, 140))
    draw.text((85, 602), "Example: A simple pendulum at its highest point possesses potential energy.", fill=(10, 10, 140))
    draw.text((85, 634), "As it swings downwards towards the mean position, potential energy transforms", fill=(10, 10, 140))
    draw.text((85, 666), "into kinetic energy, reaching maximum speed at the center.", fill=(10, 10, 140))

    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, format="PNG")
    print(f"Saved Answer Script to {path}")

if __name__ == "__main__":
    qp_path = "/home/puneeth/programmes/grader-ai/static/assets/synthetic_question_paper.png"
    ans_path = "/home/puneeth/programmes/grader-ai/static/assets/synthetic_answer_script.png"
    create_question_paper(qp_path)
    create_answer_script(ans_path)
