from django.urls import path
from . import views

urlpatterns = [
    # Main SPA Entrypoint
    path('', views.index, name='index'),
    
    # REST API Endpoints
    path('api/upload/', views.upload_resume, name='api_upload'),
    path('api/analyze/<int:resume_id>/', views.analyze_resume, name='api_analyze'),
    path('api/job-match/<int:resume_id>/', views.match_job, name='api_job_match'),
    path('api/interview-prep/<int:resume_id>/', views.interview_prep, name='api_interview_prep'),
    path('api/chat/<int:resume_id>/', views.chat_coach, name='api_chat_coach'),
    path('api/history/', views.upload_history, name='api_history'),
    path('api/admin-stats/', views.admin_stats, name='api_admin_stats'),
]
