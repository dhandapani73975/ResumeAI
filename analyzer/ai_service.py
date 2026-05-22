import os
import json
import requests
from django.conf import settings
from .models import UsageLog

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama3-70b-8192"

def get_groq_api_key():
    """
    Fetches the Groq API key from environment variables.
    """
    return os.getenv('GROQ_API_KEY', '')

def _call_groq_api(system_prompt, user_prompt, response_format_json=True, action_name='ai_request'):
    """
    Private helper to make direct HTTP requests to Groq API.
    Uses requests directly to avoid setup conflicts with SDKs, and supports mock fallback.
    """
    api_key = get_groq_api_key()
    
    if not api_key:
        # Fallback to Mock Mode
        print(f"[AI Service] No GROQ_API_KEY configured. Running {action_name} in Mock Mode.")
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
    }

    if response_format_json:
        payload["response_format"] = {"type": "json_object"}

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=45)
        response.raise_for_status()
        
        result = response.json()
        tokens = result.get('usage', {}).get('total_tokens', 0)
        
        # Log usage
        UsageLog.objects.create(
            action=action_name,
            tokens_used=tokens,
            status='success'
        )

        content = result['choices'][0]['message']['content']
        return content
    except Exception as e:
        print(f"[AI Service] Error calling Groq API for {action_name}: {str(e)}")
        UsageLog.objects.create(
            action=action_name,
            tokens_used=0,
            status=f'failed: {str(e)[:15]}'
        )
        return None

def analyze_resume_ai(resume_text):
    """
    Analyzes resume text using Groq Llama3 to return a structured feedback profile.
    """
    system_prompt = """
    You are an expert ATS (Applicant Tracking System) compiler and veteran recruiter.
    Analyze the provided resume and return a detailed, rigorous evaluation in JSON format.
    You must strictly respond with a valid JSON object matching this exact structure:
    {
      "ats_score": 85, // Integer between 0 and 100
      "strength_score": 78, // Integer between 0 and 100
      "detected_skills": ["Python", "Django", "SQL", "Git"], // List of key technical/soft skills detected
      "missing_skills": ["Docker", "AWS", "CI/CD"], // Relevant skills commonly paired with these that are missing
      "suggestions": [
        "Rephrase bullet points to emphasize impact (e.g. 'Reduced load times by 20% using redis caching')",
        "Add a dedicated skills section to improve parsing capability"
      ], // Grammar, formatting, or bullet style tips
      "role_matches": [
        {"role": "Backend Engineer", "score": 90},
        {"role": "Fullstack Developer", "score": 80}
      ], // Ideal roles with compatibility scores
      "keyword_optimizations": [
        {"keyword": "REST API", "reason": "Extremely common in backend specs. Add it under your Django experience."},
        {"keyword": "Kubernetes", "reason": "Recommended for cloud engineering roles."}
      ], // Missing keywords that are highly search-friendly for recruiters
      "experience_critique": "Your experience shows strong back-end proficiency with web frameworks. To strengthen it, quantize your accomplishments (e.g., speed increases, conversion, load handling).",
      "project_critique": "Projects are well described, but need link/deploy context. Add technologies used directly in titles.",
      "actionable_tips": [
        "Create a robust github portfolio showing live deployments",
        "Refine layout to fit exactly on 1 or 2 pages"
      ]
    }
    Make the evaluation professional, high-fidelity, and realistic.
    """

    user_prompt = f"Here is the resume text to evaluate:\n\n{resume_text}"
    
    content = _call_groq_api(system_prompt, user_prompt, response_format_json=True, action_name='analysis')
    
    if content:
        try:
            return json.loads(content)
        except Exception:
            pass
            
    # Fallback to high-fidelity mock generator
    return generate_mock_analysis(resume_text)

def match_resume_to_job_ai(resume_text, job_description):
    """
    Performs interactive JD matching to compute compatibility and keyword alignment.
    """
    system_prompt = """
    You are an AI Job Matching Assistant. Compare the provided resume text against the job description.
    Compute their overlap, keyword gaps, and recommended actions.
    Return a valid JSON object matching this exact structure:
    {
      "compatibility_score": 75, // Integer (0 to 100) representing fit
      "role_fit": "Excellent profile match for core coding duties. Slightly lacking in cloud deployment operations.",
      "matched_keywords": ["Python", "Django", "PostgreSQL", "REST APIs"], // Keywords found in both
      "missing_keywords": ["Docker", "Kubernetes", "AWS ECS", "CI/CD Pipelines"], // Keywords in JD but missing in resume
      "suggested_bullet_points": [
        "Demonstrated cloud deployment experience using AWS ECS and CI/CD pipelines.",
        "Containerized core microservices utilizing Docker for consistent dev/prod workflows."
      ], // AI-written ready-to-use bullet points tailored for this JD
      "action_plan": [
        "Incorporate docker containers into your recent Django project",
        "Add CI/CD pipelines highlight to your DevOps skills list"
      ]
    }
    """

    user_prompt = f"Resume:\n{resume_text}\n\nJob Description:\n{job_description}"
    
    content = _call_groq_api(system_prompt, user_prompt, response_format_json=True, action_name='job_match')
    
    if content:
        try:
            return json.loads(content)
        except Exception:
            pass
            
    return generate_mock_job_match(resume_text, job_description)

def generate_interview_prep_ai(resume_text):
    """
    Generates tailored technical, HR, and project interview questions.
    """
    system_prompt = """
    You are an AI Interview Coach. Based on the candidate's resume, generate an active preparation workbook.
    Return a valid JSON object with the following structure:
    {
      "questions": [
        {
          "id": 1,
          "category": "Technical", // 'Technical', 'HR', or 'Project'
          "question": "How do you optimize slow query performances in Django's ORM?",
          "tip": "Mention select_related, prefetch_related, database indexes, and profiling tools like Django Debug Toolbar."
        },
        {
          "id": 2,
          "category": "Project",
          "question": "Can you describe the design architecture of your chat application project?",
          "tip": "Explain the WebSocket protocol, Django Channels, redis layer, and message broadcast mechanism."
        },
        {
          "id": 3,
          "category": "HR",
          "question": "Tell me about a time you had a technical disagreement with a team member. How did you resolve it?",
          "tip": "Use the STAR method: Situation, Task, Action, Result. Focus on objective benchmarks, collaborative testing, and mutual respect."
        }
      ],
      "tips": [
        "Conduct mock video reads to control speaking pace.",
        "Refine your project elevator pitch to be under 90 seconds."
      ]
    }
    """

    user_prompt = f"Candidate Resume:\n{resume_text}"
    
    content = _call_groq_api(system_prompt, user_prompt, response_format_json=True, action_name='interview_prep')
    
    if content:
        try:
            return json.loads(content)
        except Exception:
            pass
            
    return generate_mock_interview(resume_text)

def get_career_chat_response_ai(resume_text, chat_history, user_message):
    """
    Provides real-time interactive chat with the AI Resume Coach.
    """
    system_prompt = f"""
    You are 'ResumeAI Coach', a world-class career strategist and resume optimization consultant.
    You have analyzed the user's resume, which is detailed below. Use it to answer all questions contextually.
    
    Candidate Resume Details:
    {resume_text}
    
    Guidelines:
    1. Be highly practical, encouraging, and critical when helpful.
    2. Suggest concrete improvements, alternative wordings, or skill pathways.
    3. Keep responses conversational, concise, and structured with bullet points.
    4. Provide specific inline code snippets or resume rewrite examples when asked.
    """

    messages = [{"role": "system", "content": system_prompt}]
    for msg in chat_history[-6:]:  # Keep context window compact
        messages.append({"role": msg['sender'], "content": msg['text']})
    messages.append({"role": "user", "content": user_message})

    api_key = get_groq_api_key()
    if not api_key:
        return generate_mock_chat_response(user_message, resume_text)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": DEFAULT_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 800
    }

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        result = response.json()
        UsageLog.objects.create(action='chat', tokens_used=result.get('usage', {}).get('total_tokens', 0), status='success')
        return result['choices'][0]['message']['content']
    except Exception as e:
        print(f"[AI Service] Chat error: {str(e)}")
        return generate_mock_chat_response(user_message, resume_text)


# ==========================================
# HIGH-FIDELITY SMART MOCK DATA GENERATORS
# ==========================================

def _detect_keywords(text):
    """
    Inspects resume text to extract core skills and profile indicators.
    """
    text_lower = text.lower()
    skills = []
    
    potential_skills = {
        'Python': ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy'],
        'JavaScript': ['javascript', 'js', 'react', 'vue', 'angular', 'node', 'express', 'nextjs', 'typescript', 'ts'],
        'Java': ['java', 'spring', 'springboot', 'maven'],
        'C++': ['c++', 'cpp', 'qt'],
        'SQL': ['sql', 'postgres', 'postgresql', 'mysql', 'sqlite', 'oracle'],
        'NoSQL': ['mongodb', 'redis', 'cassandra', 'elasticsearch'],
        'AWS': ['aws', 'amazon web', 's3', 'ec2', 'rds', 'lambda'],
        'Docker': ['docker', 'container', 'kubernetes', 'k8s'],
        'CI/CD': ['ci/cd', 'jenkins', 'github actions', 'gitlab ci'],
        'HTML/CSS': ['html', 'css', 'tailwind', 'bootstrap', 'sass'],
        'Machine Learning': ['machine learning', 'deep learning', 'pytorch', 'tensorflow', 'scikit', 'nlp', 'ai', 'computer vision'],
        'Data Analysis': ['data analysis', 'excel', 'tableau', 'powerbi', 'r studio'],
        'Project Management': ['agile', 'scrum', 'jira', 'project manager', 'product owner']
    }

    for skill, patterns in potential_skills.items():
        for pattern in patterns:
            if pattern in text_lower:
                skills.append(skill)
                break
                
    if not skills:
        skills = ["Communication", "Problem Solving", "Software Engineering", "Teamwork"]
    return skills

def generate_mock_analysis(text):
    detected = _detect_keywords(text)
    
    # Establish a customized ATS score based on length and tech skills density
    base_score = 60
    if len(text) > 1000: base_score += 10
    if len(detected) >= 4: base_score += 15
    base_score = min(base_score + (len(text) % 11), 95)
    
    strength = min(base_score - 4 + (len(text) % 9), 92)

    all_missing = ["Docker", "Kubernetes", "AWS Cloud", "Redis Caching", "CI/CD Pipelines", "Unit Testing (PyTest/Jest)", "TypeScript", "System Design", "Microservices"]
    missing = [m for m in all_missing if m.lower() not in text.lower()][:3]
    if not missing:
        missing = ["GraphQL Integration", "Terraform IaC", "Performance Auditing"]

    role_pools = [
        {"role": "Backend Architect", "match_keyword": "python"},
        {"role": "Fullstack Software Engineer", "match_keyword": "javascript"},
        {"role": "Data Scientist / AI Engineer", "match_keyword": "machine learning"},
        {"role": "Cloud Platforms Developer", "match_keyword": "aws"},
        {"role": "Product Delivery Specialist", "match_keyword": "agile"}
    ]
    
    role_matches = []
    for p in role_pools:
        is_match = any(k.lower() in text.lower() for k in [p['match_keyword']])
        score = 88 if is_match else 65
        score += len(text) % 7
        role_matches.append({"role": p['role'], "score": min(score, 96)})
        
    role_matches = sorted(role_matches, key=lambda x: x['score'], reverse=True)[:2]

    return {
        "ats_score": base_score,
        "strength_score": strength,
        "detected_skills": detected,
        "missing_skills": missing,
        "suggestions": [
            "Quantify results in your experience section! Instead of 'assisted in backend dev', use 'Designed 12 backend REST endpoints reducing latency by 14%'.",
            "Modernize the design format. Avoid multiple columns or heavily formatted tables which confuse classic ATS engines.",
            "Integrate active verbs to lead each sentence (e.g., 'Engineered', 'Orchestrated', 'Optimized', 'Led')."
        ],
        "role_matches": role_matches,
        "keyword_optimizations": [
            {"keyword": "CI/CD Pipelines", "reason": "Extremely frequent in technical job specifications. Highlight any automated testing routines you configured."},
            {"keyword": "Agile Methodology", "reason": " recruiters actively look for this keyword to assess collaboration maturity."}
        ],
        "experience_critique": "You show excellent practical competence. However, the descriptions are task-oriented rather than achievement-oriented. Frame your work around the business or technical outcomes.",
        "project_critique": "Your projects show high technical complexity but lack metrics. Add technical stack tags next to each project title so parsers capture them instantly.",
        "actionable_tips": [
            "Shift to a clean single-column layout using our modern templates.",
            "Write a concise, high-impact Professional Summary at the very top (3 lines maximum).",
            "Rename sections to standard terms (e.g., 'Work Experience' instead of 'My Career Journey')."
        ]
    }

def generate_mock_job_match(resume_text, job_description):
    detected_res = set(k.lower() for k in _detect_keywords(resume_text))
    detected_jd = set(k.lower() for k in _detect_keywords(job_description))
    
    matched = list(detected_res.intersection(detected_jd))
    missing = list(detected_jd - detected_res)
    
    # Capitalize for beauty
    matched = [m.title() for m in matched]
    missing = [m.title() for m in missing]
    
    if not missing:
        missing = ["System Architecture", "Continuous Integration"]
    if not matched:
        matched = ["Software Engineering", "Core Logic Development"]

    score = 50 + min(len(matched) * 12, 40) + (len(job_description) % 9)
    score = min(score, 98)

    return {
        "compatibility_score": score,
        "role_fit": "Your profile demonstrates a solid alignment with the operational requirements. The primary gap exists around cloud infrastructure operations and continuous delivery pipelines.",
        "matched_keywords": matched,
        "missing_keywords": missing,
        "suggested_bullet_points": [
            f"Implemented modern system paradigms leveraging {', '.join(missing[:2])} to enhance application scaling.",
            f"Designed core microservices collaborating across cross-functional teams with optimized data strategies."
        ],
        "action_plan": [
            "Incorporate keywords from the missing list directly into your professional experience section.",
            "Tailor your profile summary to match the core technologies listed in the Job Description."
        ]
    }

def generate_mock_interview(resume_text):
    skills = _detect_keywords(resume_text)
    primary_skill = skills[0] if skills else "Software Engineering"
    
    return {
        "questions": [
            {
                "id": 1,
                "category": "Technical",
                "question": f"Explain the architectural difference between a monolithic codebase and microservices in the context of {primary_skill}.",
                "tip": "Explain service separation, communications (HTTP/gRPC/Queues), database isolation, and scaling advantages."
            },
            {
                "id": 2,
                "category": "Project",
                "question": "Walk me through the most technically challenging project on your resume. What trade-offs did you make?",
                "tip": "Structure around the STAR model. Be honest about mistakes, focus on scalability decisions, and how you evaluated performance."
            },
            {
                "id": 3,
                "category": "HR",
                "question": "Where do you see yourself in five years? How does this role align with your personal growth roadmap?",
                "tip": "Align your progression with deep technical expertise or leadership, showing commitment to learning, stability, and contributing to the company's success."
            }
        ],
        "tips": [
            "Re-read the requirements of the job description 10 minutes prior to the talk.",
            "Keep technical answers structured: brief definition, operational example, project citation, and performance metrics."
        ]
    }

def generate_mock_chat_response(user_message, resume_text):
    msg = user_message.lower()
    skills = _detect_keywords(resume_text)
    
    if "skill" in msg or "missing" in msg:
        return f"### AI Career Coach Insights 🚀\n\nBased on your resume, you have strong capabilities in **{', '.join(skills)}**. However, modern industry standards recommend strengthening the following areas:\n\n1. **Cloud Architecture**: Consider adding basic certifications or projects showcasing AWS, GCP, or Azure.\n2. **Containers**: Understanding **Docker** is highly sought-after. Try containerizing one of your existing backend repositories.\n3. **Automated Testing**: Recruiting pipelines look for developers who write unit tests (using frameworks like `unittest`, `pytest` or `jest`).\n\nWould you like me to draft a bullet point for your experience section showing how you containerized an application?"
    
    elif "rewrite" in msg or "bullet" in msg or "resume" in msg:
        return "### Experience Bullet Rewrite ✍️\n\nHere is a professional, high-impact rewrite that transforms a generic project task into a result-driven accomplishment:\n\n* **Before**: *'Built a backend web application using Python and Django and added some database optimizations.'*\n* **After (Recruiter-Optimized)**: 🚀 *'Engineered a scalable REST API using **Python/Django**, implementing indexing and select-related queries that reduced database roundtrips by **32%** and decreased average server response latency to **180ms**.'*\n\n**Why this works:**\n- Leads with a strong action verb (**Engineered**).\n- Explicitly highlights the technology stack (**Python/Django**).\n- Quantifies the business and technical impact (**32% roundtrip reduction**, **180ms latency**)."

    else:
        return f"### Welcome to ResumeAI Coach! 👋\n\nI have reviewed your resume and noticed strong background knowledge in **{', '.join(skills[:3])}**.\n\nYou can ask me anything, for instance:\n- *'How can I optimize my experience bullet points?'*\n- *'What skills are missing for a Senior backend engineer role?'*\n- *'Can you write a professional summary for my resume?'*\n\nTell me, what job role or career goal are you targeting next?"
