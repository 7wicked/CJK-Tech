const SKILL_VOCAB = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'c', 'go', 'rust', 'ruby', 'php',
  'react', 'vue', 'angular', 'node.js', 'node', 'express', 'next.js', 'django', 'flask',
  'spring', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'graphql', 'rest api', 'microservices',

  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'ci/cd', 'git', 'linux',
  'cloud architecture', 'system design', 'distributed systems', 'scalability', 'high availability',

  'machine learning', 'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'keras',
  'nlp', 'llm', 'prompt engineering', 'computer vision',

  'html', 'css', 'sass', 'figma', 'agile', 'scrum', 'project management', 'roadmap',
  'stakeholder management', 'communication', 'leadership', 'sales', 'marketing', 'seo', 'excel',

  'kotlin', 'android', 'swift', 'ios', 'flutter', 'react native', 'firebase',

  'monitoring', 'incident response', 'prometheus', 'grafana',

  'etl', 'spark', 'airflow', 'hadoop', 'kafka', 'tableau', 'power bi', 'data visualization',

  'selenium', 'cypress', 'jest', 'junit', 'manual testing', 'automation testing', 'jira',

  'cybersecurity', 'networking', 'tcp/ip', 'dns', 'firewall', 'penetration testing', 'siem', 'iam',

  'database administration', 'oracle', 'postgresql', 'mysql',

  'ui design', 'ux design', 'wireframing', 'user research', 'prototyping', 'sketch', 'adobe xd',

  'solidity', 'blockchain', 'ethereum', 'web3', 'smart contracts',

  'unity', 'unreal engine', 'game design',

  'technical writing', 'documentation', 'markdown', 'api documentation',
  'confluence', 'technical documentation', 'content writing'
];

function screenResume({ name, email, phone, resumeText }) {
  const text = resumeText || '';
  const lowerText = text.toLowerCase();

  const extractedEmail =
    email ||
    (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] ||
    '';

  const extractedPhone =
    phone ||
    (text.match(/\+?\d[\d\s().-]{8,}\d/) || [])[0] ||
    '';

  const skills = SKILL_VOCAB.filter(skill =>
    lowerText.includes(skill.toLowerCase())
  );

  const experienceMatch = lowerText.match(/(\d+)\+?\s*(?:years?|yrs?)\b/);
  const experienceYears = experienceMatch
    ? Number.parseInt(experienceMatch[1], 10)
    : 0;

  let educationLevel = 'Unspecified';

  if (/\b(phd|doctorate)\b/.test(lowerText)) {
    educationLevel = 'PhD';
  } else if (/\b(mba|m\.?tech|m\.?s\.?|master)\b/.test(lowerText)) {
    educationLevel = 'Master';
  } else if (/\b(b\.?tech|b\.?s\.?|bachelor)\b/.test(lowerText)) {
    educationLevel = 'Bachelor';
  } else if (/\b(diploma|associate)\b/.test(lowerText)) {
    educationLevel = 'Diploma';
  }

  const words = text.trim().split(/\s+/).filter(Boolean);

  return {
    name: name || '',
    email: extractedEmail,
    phone: extractedPhone,
    skills,
    experienceYears,
    educationLevel,
    resumeText: text,
    wordCount: words.length
  };
}

function validateCandidate(profile) {
  const issues = [];

  if (!profile.name?.trim()) {
    issues.push('Missing candidate name');
  }

  if (!profile.email) {
    issues.push('Missing email address');
  } else if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(profile.email)) {
    issues.push('Email address looks malformed');
  }

  if (!profile.phone) {
    issues.push('Missing phone number');
  }

  if (profile.wordCount < 40) {
    issues.push('Resume text looks too short to be a real CV');
  }

  if (!Array.isArray(profile.skills) || profile.skills.length === 0) {
    issues.push('No recognizable skills found on resume');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function matchToRole(profile, role) {
  const requiredSkills = (role.mustHaveSkills || [])
    .map(skill => skill.toLowerCase());

  const preferredSkills = (role.niceToHaveSkills || [])
    .map(skill => skill.toLowerCase());

  const candidateSkills = (profile.skills || [])
    .map(skill => skill.toLowerCase());

  const matchedMustHave = requiredSkills.filter(skill =>
    candidateSkills.includes(skill)
  );

  const missingMustHave = requiredSkills.filter(skill =>
    !candidateSkills.includes(skill)
  );

  const matchedNiceToHave = preferredSkills.filter(skill =>
    candidateSkills.includes(skill)
  );

  const missingNiceToHave = preferredSkills.filter(skill =>
    !candidateSkills.includes(skill)
  );

  const mustHaveCoverage = requiredSkills.length
    ? Math.round((matchedMustHave.length / requiredSkills.length) * 100)
    : 100;

  const niceToHaveCoverage = preferredSkills.length
    ? Math.round((matchedNiceToHave.length / preferredSkills.length) * 100)
    : 0;

  const minimumExperience = role.minExperienceYears || 0;
  const experienceFit =
    profile.experienceYears >= minimumExperience ? 'meets' : 'below';

  const experiencePoints = experienceFit === 'meets' ? 15 : 0;

  let score = Math.round(
    mustHaveCoverage * 0.6 +
    niceToHaveCoverage * 0.25 +
    experiencePoints
  );

  score = Math.max(0, Math.min(100, score));

  let status;

  if (
    mustHaveCoverage === 100 &&
    experienceFit === 'meets' &&
    score >= 70
  ) {
    status = 'shortlisted';
  } else if (score >= 45) {
    status = 'consider';
  } else {
    status = 'rejected';
  }

  const nextActionMap = {
    shortlisted: 'Schedule interview',
    consider: 'Manual recruiter review',
    rejected: 'Send rejection notice'
  };

  const analysisParts = [
    `Covers ${matchedMustHave.length}/${requiredSkills.length} must-have skill${matchedMustHave.length === 1 ? '' : 's'} for ${role.title}${matchedMustHave.length ? ` (${matchedMustHave.join(', ')})` : ''}.`,
    missingMustHave.length
      ? `Missing: ${missingMustHave.join(', ')}.`
      : null,
    matchedNiceToHave.length
      ? `Bonus skills: ${matchedNiceToHave.join(', ')}.`
      : null,
    experienceFit === 'meets'
      ? `Experience (${profile.experienceYears}y) meets the ${minimumExperience}y minimum.`
      : `Experience (${profile.experienceYears}y) is below the ${minimumExperience}y minimum.`
  ];

  return {
    score,
    status,
    mustHaveCoverage,
    niceToHaveCoverage,
    experienceFit,
    matchedMustHave,
    missingMustHave,
    matchedNiceToHave,
    missingNiceToHave,
    nextAction: nextActionMap[status],
    analysis: analysisParts.filter(Boolean).join(' ')
  };
}

function draftInterviewInvite({ name, roleTitle }) {
  const firstName = name?.trim()?.split(/\s+/)[0] || 'there';

  return {
    subject: `Interview invitation — ${roleTitle}`,
    body: `Hi ${firstName},

Thanks for applying for the ${roleTitle} role! Your background looks like a strong match and we'd like to move forward with an interview.

Could you share a few times that work for you over the next week?

Best,
Recruiting Team`
  };
}

module.exports = {
  SKILL_VOCAB,
  screenResume,
  validateCandidate,
  matchToRole,
  draftInterviewInvite
};