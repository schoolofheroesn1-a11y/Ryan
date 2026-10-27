# AcademiTrack — Student Portfolio

A shared student portfolio with three portals:

| Portal | What they can do |
|---|---|
| **Teacher** | Upload tasks & exams (CSV / Excel), upload custom progress tables, attach documents, add students, grade, take attendance |
| **Student** | See upcoming / overdue tasks, exam results over time, teacher feedback, goals; upload their own work |
| **Parent** | See each child's grades, tasks, exams, progress tables and documents; upload notes or certificates |

Everything is stored on the server (`data/store.json` + `data/uploads/`), so an upload made in one portal shows up in the others, on any device, within a few seconds.

## Running

```bash
npm install
npm run dev          # http://localhost:3000
# production
npm run build && NODE_ENV=production npm start
```

Set `DATA_DIR` to keep the data somewhere other than `./data` (e.g. a mounted volume).

## Uploading tasks & exams

Click **Upload → Tasks & Exams** and choose a `.csv` or `.xlsx` file. The first row must be headings.
**Download template** in the dialog gives a ready-made example.

| Column | Required | Notes |
|---|---|---|
| Subject | ✓ | New subject names are created automatically |
| Title | ✓ | Re-uploading a row with the same title updates it |
| Student | | Name or student ID. Without this column, all rows go to the selected student. Unknown names create a new portfolio |
| Type | | Homework, Quiz, Exam, Project, Lab (also accepts Test, Task, Midterm…) |
| Score | | Number, or `45/50` |
| Max Score | | Defaults to 100 |
| Weight | | % weight in the subject grade; sensible default per type |
| Due Date | | `YYYY-MM-DD` or any date Excel exports |
| Status | | Graded, Pending, Late, Missing (guessed from the score if blank) |
| Feedback | | Shown to the student and parents |

## Progress tables

**Upload → Progress Table** takes any CSV / Excel table (reading logs, behaviour charts, skills checklists…) and shows it as-is in the portfolio.

## Documents

PDF, images, Word, Excel and PowerPoint files up to 10 MB. Teachers can delete any document; students and parents can delete what they uploaded.

## Important: no login yet

Anyone who can open the site can switch between portals and see every student. Before using it with real student data, add authentication (e.g. a school Google sign-in) and restrict the `/api/*` and `/uploads` routes per user.
