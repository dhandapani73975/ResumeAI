from django.db import models

class Resume(models.Model):
    file = models.FileField(upload_to='resumes/')
    filename = models.CharField(max_length=255)
    extracted_text = models.TextField(blank=True, default='')
    analysis_result = models.JSONField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.filename

class JobMatch(models.Model):
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name='job_matches')
    job_title = models.CharField(max_length=255, blank=True, default='')
    job_description = models.TextField()
    match_score = models.IntegerField(default=0)
    match_details = models.JSONField(null=True, blank=True)
    matched_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.resume.filename} match for {self.job_title or 'Job'}"

class InterviewSession(models.Model):
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name='interviews')
    questions = models.JSONField(null=True, blank=True)  # List of {type: '', question: '', tip: ''}
    feedback = models.JSONField(null=True, blank=True)   # User answers or performance review
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Interview prep for {self.resume.filename}"

class UsageLog(models.Model):
    action = models.CharField(max_length=50)  # e.g., 'upload', 'analysis', 'job_match', 'interview_prep', 'chat'
    timestamp = models.DateTimeField(auto_now_add=True)
    tokens_used = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default='success')

    def __str__(self):
        return f"{self.action} - {self.timestamp} ({self.status})"
