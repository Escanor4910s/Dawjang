import os

files_to_export = [
    "src/pages/Dashboard.tsx",
    "src/pages/Flashcards.tsx",
    "src/pages/Summaries.tsx",
    "src/pages/SummaryView.tsx",
    "src/pages/QuizLibrary.tsx",
    "src/pages/Quiz.tsx",
    "src/pages/Ecos.tsx",
    "src/pages/Review.tsx",
    "src/pages/ReviewPlanner.tsx",
    "src/pages/MyPlan.tsx"
]

output_file = "dashboard_pages_code.md"

with open(output_file, "w", encoding="utf-8") as out:
    for f in files_to_export:
        out.write(f"\n\n# File: {f}\n```tsx\n")
        try:
            with open(f, "r", encoding="utf-8") as infile:
                out.write(infile.read())
        except Exception as e:
            out.write(f"// Error reading file: {e}\n")
        out.write("\n```\n")

print(f"Exported to {output_file}")
