import asyncio
import json
import httpx

async def test():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Admin login
        admin_login = await client.post("/api/auth/login", json={"email": "admin@edumaster.com", "password": "password123"})
        print("Admin login status:", admin_login.status_code)
        assert admin_login.status_code == 200, "Admin login failed"
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Student login
        stu_login = await client.post("/api/auth/login", json={"email": "kasun@example.com", "password": "password123"})
        print("Student login status:", stu_login.status_code)
        assert stu_login.status_code == 200, "Student login failed"
        stu_token = stu_login.json()["access_token"]
        stu_headers = {"Authorization": f"Bearer {stu_token}"}

        # 1. Lecturer Insights with learning_growth
        r1 = await client.get("/api/modules/6/sections/9/lecturer-insights", headers=admin_headers)
        print("Insights status:", r1.status_code)
        assert r1.status_code == 200
        insights = r1.json()
        print("Pre-readiness vs Post-mastery Learning growth:")
        print(json.dumps(insights.get("learning_growth"), indent=2))
        print("Recommendations:")
        for rec in insights.get("lecture_focus_recommendations", [])[:2]:
            print(" *", rec.encode("ascii", "replace").decode())

        # 2. Admin 100-Point Gradebook
        r2 = await client.get("/api/modules/6/grades", headers=admin_headers)
        print("\nAdmin grades status:", r2.status_code)
        assert r2.status_code == 200
        gb = r2.json()
        print("Weights:", gb.get("formula_weights"))
        print("Total students in gradebook:", len(gb.get("final_gradebook", [])))
        for s in gb.get("final_gradebook", []):
            p = s["pillars"]
            print(f"-> {s['student_name']}: Written {p['written_exams_score']}/60, Vivas {p['weekly_vivas_score']}/10, Asgn+Def {p['assignments_score']}/15, Pres/Quiz {p['presentation_or_quizzes_score']}/15 => TOTAL: {p['total_score']}/100 [{p['letter_grade']}] - {p['status']}")

        # 3. Student 100-Point Gradebook
        r3 = await client.get("/api/modules/6/grades", headers=stu_headers)
        print("\nStudent grades status:", r3.status_code)
        assert r3.status_code == 200
        stu_gb = r3.json()
        my_g = stu_gb.get("my_grade")
        print(f"Student View ({my_g['student_name']}): Total {my_g['pillars']['total_score']}/100 Grade: {my_g['pillars']['letter_grade']}")

        # 4. Weekly Viva Chat test
        r4 = await client.post("/api/modules/items/22/weekly-viva/chat", headers=stu_headers, json={
            "message": "In the lecture we analyzed how perceptrons compute linear combinations and why ReLU solves the vanishing gradient issue.",
            "history": [],
            "finish_early": False
        })
        print("\nWeekly viva chat response status:", r4.status_code)
        assert r4.status_code == 200
        print("Feedback:", r4.json().get("feedback")[:80])
        print("Next question:", (r4.json().get("next_question") or "")[:80])

        # 5. Assignment Defense Chat test
        r5 = await client.post("/api/modules/submissions/2/defense/chat", headers=stu_headers, json={
            "message": "I vectorized the batch matrix multiplication in NumPy to avoid slow Python loops.",
            "history": [],
            "finish_early": False
        })
        print("\nAssignment defense status:", r5.status_code)
        assert r5.status_code == 200
        print("Defense feedback:", r5.json().get("feedback")[:80])

        # 6. Exam Grade update test
        r6 = await client.post("/api/modules/6/grades/exams/1", headers=admin_headers, json={
            "mid_exam_score": 88.0,
            "end_exam_score": 92.0,
            "presentation_score": 95.0,
            "notes": "Excellent final defense"
        })
        print("\nExam update status:", r6.status_code)
        assert r6.status_code == 200
        print("Updated exam grade:", r6.json())

        print("\nALL 6 BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test())
