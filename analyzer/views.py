import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Avg

from .models import Resume, JobMatch, InterviewSession, UsageLog
from .parser import extract_text_from_file
from .ai_service import (
    analyze_resume_ai,
    match_resume_to_job_ai,
    generate_interview_prep_ai,
    get_career_chat_response_ai
)

def index(request):
    """
    Renders the Single Page Application template.
    """
    return render(request, 'index.html')

@csrf_exempt
def upload_resume(request):
    """
    API endpoint to upload a resume (PDF/DOCX), parse its text, and store in DB.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
        
    file_obj = request.FILES.get('resume')
    if not file_obj:
        return JsonResponse({'error': 'No file uploaded'}, status=400)
        
    try:
        # Create Resume model entry
        resume = Resume.objects.create(
            file=file_obj,
            filename=file_obj.name
        )
        
        # Extract text using parser
        extracted_text = extract_text_from_file(resume.file.path)
        resume.extracted_text = extracted_text
        resume.save()
        
        # Log action
        UsageLog.objects.create(action='upload', status='success')
        
        return JsonResponse({
            'id': resume.id,
            'filename': resume.filename,
            'uploaded_at': resume.uploaded_at.strftime('%Y-%m-%d %H:%M:%S'),
            'character_count': len(extracted_text),
            'message': 'Resume uploaded and parsed successfully!'
        })
        
    except Exception as e:
        # Clean up if failed
        if 'resume' in locals() and resume.id:
            resume.delete()
            
        UsageLog.objects.create(action='upload', status=f'failed: {str(e)[:15]}')
        return JsonResponse({'error': str(e)}, status=500)

def analyze_resume(request, resume_id):
    """
    API endpoint to trigger/fetch AI resume analysis.
    """
    resume = get_object_or_404(Resume, id=resume_id)
    
    if not resume.analysis_result:
        try:
            analysis = analyze_resume_ai(resume.extracted_text)
            resume.analysis_result = analysis
            resume.save()
        except Exception as e:
            return JsonResponse({'error': f'AI Analysis failed: {str(e)}'}, status=500)
            
    return JsonResponse(resume.analysis_result)

@csrf_exempt
def match_job(request, resume_id):
    """
    API endpoint to match a resume against a job description.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
        
    resume = get_object_or_404(Resume, id=resume_id)
    
    try:
        data = json.loads(request.body)
        job_title = data.get('job_title', 'Target Role')
        job_description = data.get('job_description', '')
    except Exception:
        job_title = request.POST.get('job_title', 'Target Role')
        job_description = request.POST.get('job_description', '')
        
    if not job_description.strip():
        return JsonResponse({'error': 'Job description is required'}, status=400)
        
    try:
        match_data = match_resume_to_job_ai(resume.extracted_text, job_description)
        
        # Save JobMatch record
        JobMatch.objects.create(
            resume=resume,
            job_title=job_title,
            job_description=job_description,
            match_score=match_data.get('compatibility_score', 0),
            match_details=match_data
        )
        
        return JsonResponse(match_data)
    except Exception as e:
        return JsonResponse({'error': f'Job matching failed: {str(e)}'}, status=500)

def interview_prep(request, resume_id):
    """
    API endpoint to fetch or generate customized interview prep questions.
    """
    resume = get_object_or_404(Resume, id=resume_id)
    
    # Check if a session already exists
    session = resume.interviews.first()
    
    if not session:
        try:
            prep_data = generate_interview_prep_ai(resume.extracted_text)
            session = InterviewSession.objects.create(
                resume=resume,
                questions=prep_data.get('questions', []),
                feedback={'tips': prep_data.get('tips', [])}
            )
        except Exception as e:
            return JsonResponse({'error': f'Interview prep generation failed: {str(e)}'}, status=500)
            
    return JsonResponse({
        'questions': session.questions,
        'tips': session.feedback.get('tips', [])
    })

@csrf_exempt
def chat_coach(request, resume_id):
    """
    API endpoint to interact with the AI career coach chat assistant.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
        
    resume = get_object_or_404(Resume, id=resume_id)
    
    try:
        data = json.loads(request.body)
        user_message = data.get('message', '')
        history = data.get('history', [])
    except Exception:
        user_message = request.POST.get('message', '')
        history_raw = request.POST.get('history', '[]')
        try:
            history = json.loads(history_raw)
        except Exception:
            history = []
            
    if not user_message.strip():
        return JsonResponse({'error': 'Message is empty'}, status=400)
        
    try:
        coach_response = get_career_chat_response_ai(resume.extracted_text, history, user_message)
        return JsonResponse({'response': coach_response})
    except Exception as e:
        return JsonResponse({'error': f'Chat engine failed: {str(e)}'}, status=500)

def upload_history(request):
    """
    API endpoint to get previous upload history list.
    """
    resumes = Resume.objects.all().order_index_by('-uploaded_at') if hasattr(Resume.objects, 'order_index_by') else Resume.objects.all().order_by('-uploaded_at')
    
    history_list = []
    for r in resumes:
        ats_score = r.analysis_result.get('ats_score') if r.analysis_result else None
        strength_score = r.analysis_result.get('strength_score') if r.analysis_result else None
        
        # Calculate recent job matches count
        job_matches = r.job_matches.all()
        highest_match = max([jm.match_score for jm in job_matches]) if job_matches else None
        
        history_list.append({
            'id': r.id,
            'filename': r.filename,
            'uploaded_at': r.uploaded_at.strftime('%Y-%m-%d %H:%M'),
            'ats_score': ats_score,
            'strength_score': strength_score,
            'highest_job_match': highest_match,
            'matches_count': len(job_matches)
        })
        
    return JsonResponse({'history': history_list})

def admin_stats(request):
    """
    API endpoint to retrieve statistics for the Admin Panel Dashboard.
    """
    total_resumes = Resume.objects.count()
    total_matches = JobMatch.objects.count()
    
    # Calculate average ATS score
    avg_ats = 0
    all_resumes = Resume.objects.exclude(analysis_result__isnull=True)
    if all_resumes.exists():
        scores = []
        for r in all_resumes:
            if r.analysis_result and 'ats_score' in r.analysis_result:
                scores.append(r.analysis_result['ats_score'])
        if scores:
            avg_ats = round(sum(scores) / len(scores), 1)

    # Compile skills frequencies
    detected_skills_freq = {}
    missing_skills_freq = {}
    
    for r in all_resumes:
        if r.analysis_result:
            for s in r.analysis_result.get('detected_skills', []):
                detected_skills_freq[s] = detected_skills_freq.get(s, 0) + 1
            for s in r.analysis_result.get('missing_skills', []):
                missing_skills_freq[s] = missing_skills_freq.get(s, 0) + 1
                
    sorted_detected = sorted(detected_skills_freq.items(), key=lambda x: x[1], reverse=True)[:5]
    sorted_missing = sorted(missing_skills_freq.items(), key=lambda x: x[1], reverse=True)[:5]

    # Recent Usage Logs
    logs = UsageLog.objects.all().order_by('-timestamp')[:15]
    log_list = [{
        'action': l.action,
        'timestamp': l.timestamp.strftime('%H:%M:%S (%m-%d)'),
        'tokens': l.tokens_used,
        'status': l.status
    } for l in logs]
    
    # API tokens count
    total_tokens = UsageLog.objects.aggregate(total=Avg('tokens_used'))['total'] or 0
    total_tokens = int(total_tokens * UsageLog.objects.count()) # Convert avg back to rough sum

    return JsonResponse({
        'total_resumes': total_resumes,
        'total_matches': total_matches,
        'avg_ats': avg_ats,
        'detected_skills_chart': [{'skill': k, 'count': v} for k, v in sorted_detected],
        'missing_skills_chart': [{'skill': k, 'count': v} for k, v in sorted_missing],
        'usage_logs': log_list,
        'total_tokens': total_tokens,
        'groq_api_configured': bool(os.getenv('GROQ_API_KEY'))
    })
