from django.test import TestCase
from django.urls import reverse
from .models import Resume, JobMatch, UsageLog, InterviewSession
from .ai_service import generate_mock_analysis, generate_mock_job_match, generate_mock_interview

class ModelTests(TestCase):
    def setUp(self):
        self.resume = Resume.objects.create(
            filename="test_resume.pdf",
            extracted_text="Python Developer with Django experience.",
            analysis_result=generate_mock_analysis("Python Developer with Django experience.")
        )
        
    def test_resume_creation(self):
        """Verify resume instance variables are stored correctly."""
        self.assertEqual(self.resume.filename, "test_resume.pdf")
        self.assertTrue("Python" in self.resume.extracted_text)
        self.assertEqual(self.resume.analysis_result['ats_score'] > 0, True)

    def test_job_match_creation(self):
        """Verify job match associations function correctly."""
        match_data = generate_mock_job_match(self.resume.extracted_text, "Python Backend Developer Django")
        match = JobMatch.objects.create(
            resume=self.resume,
            job_title="Backend Developer",
            job_description="Python Backend Developer Django",
            match_score=match_data['compatibility_score'],
            match_details=match_data
        )
        self.assertEqual(match.resume, self.resume)
        self.assertEqual(match.job_title, "Backend Developer")
        self.assertTrue(match.match_score >= 50)

class ServiceTests(TestCase):
    def test_mock_analysis(self):
        """Verify mock resume analyzer structures standard recruitment objects."""
        text = "Experienced React developer with JavaScript and TypeScript knowledge."
        res = generate_mock_analysis(text)
        self.assertIn("ats_score", res)
        self.assertIn("strength_score", res)
        self.assertIn("detected_skills", res)
        self.assertIn("JavaScript", res["detected_skills"])

    def test_mock_interview(self):
        """Verify interview question categorizations."""
        text = "Java developer Spring Boot"
        res = generate_mock_interview(text)
        self.assertIn("questions", res)
        self.assertTrue(len(res["questions"]) > 0)
        self.assertEqual(res["questions"][0]["category"], "Technical")

class ViewsTests(TestCase):
    def setUp(self):
        self.resume = Resume.objects.create(
            filename="resume.txt",
            extracted_text="Data Scientist using Python, PyTorch and ML models.",
            analysis_result=generate_mock_analysis("Data Scientist using Python, PyTorch and ML models.")
        )

    def test_index_page(self):
        """Verify base single page application index loads correctly."""
        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

    def test_history_api(self):
        """Verify upload listing endpoint."""
        response = self.client.get(reverse('api_history'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("history", data)
        self.assertEqual(len(data["history"]), 1)
        self.assertEqual(data["history"][0]["filename"], "resume.txt")

    def test_admin_stats_api(self):
        """Verify analytics computations."""
        response = self.client.get(reverse('api_admin_stats'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_resumes"], 1)
        self.assertTrue(data["avg_ats"] > 0)
