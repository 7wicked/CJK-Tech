const express = require('express');
const cors = require('cors');

const {
    ROLES,
    getRole
} = require('./roles/roles');

const {
    saveCandidate,
    listCandidates,
    getCandidate,
    postInvite,
    listInvites
} = require('./data/candidateStore');

const {
    screenResume,
    validateCandidate,
    matchToRole,
    draftInterviewInvite
} = require('./services/resumeService');

const {
    sendInterviewNotice,
    isConfigured
} = require('./services/emailService');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
    res.json({
        message: 'Recruitment API is running',
        emailConfigured: isConfigured()
    });
});

app.get('/api/roles', (req, res) => {
    res.json(ROLES);
});

app.get('/api/roles/:id', (req, res) => {
    const role = getRole(req.params.id);

    if (!role) {
        return res.status(404).json({
            error: 'Role not found'
        });
    }

    res.json(role);
});

app.post('/api/candidates', (req, res) => {
    const {
        name,
        email,
        phone,
        resumeText,
        roleId
    } = req.body;

    if (!roleId) {
        return res.status(400).json({
            error: 'roleId is required'
        });
    }

    const role = getRole(roleId);

    if (!role) {
        return res.status(404).json({
            error: 'Role not found'
        });
    }

    const profile = screenResume({
        name,
        email,
        phone,
        resumeText
    });

    const validation = validateCandidate(profile);

    if (!validation.valid) {
        return res.status(400).json({
            error: 'Candidate validation failed',
            issues: validation.issues,
            profile
        });
    }

    const match = matchToRole(profile, role);

    const candidate = saveCandidate({
        ...profile,
        roleId,
        roleTitle: role.title,
        match
    });

    res.status(201).json(candidate);
});

app.get('/api/candidates', (req, res) => {
    const candidates = listCandidates(req.query.roleId);
    res.json(candidates);
});

app.get('/api/candidates/:id', (req, res) => {
    const candidate = getCandidate(req.params.id);

    if (!candidate) {
        return res.status(404).json({
            error: 'Candidate not found'
        });
    }

    res.json(candidate);
});

app.post('/api/candidates/:id/match', (req, res) => {
    const candidate = getCandidate(req.params.id);

    if (!candidate) {
        return res.status(404).json({
            error: 'Candidate not found'
        });
    }

    const roleId = req.body.roleId || candidate.roleId;
    const role = getRole(roleId);

    if (!role) {
        return res.status(404).json({
            error: 'Role not found'
        });
    }

    const match = matchToRole(candidate, role);

    res.json({
        candidateId: candidate.id,
        roleId: role.id,
        roleTitle: role.title,
        match
    });
});

app.post('/api/candidates/:id/interview', async (req, res) => {
    const candidate = getCandidate(req.params.id);

    if (!candidate) {
        return res.status(404).json({
            error: 'Candidate not found'
        });
    }

    if (candidate.match?.status !== 'shortlisted') {
        return res.status(400).json({
            error: 'Candidate is not shortlisted for an interview'
        });
    }

    const inviteDetails = req.body || {};

    const invite = postInvite(candidate, inviteDetails);

    const email = draftInterviewInvite({
        name: candidate.name,
        roleTitle: candidate.roleTitle
    });

    const emailResult = await sendInterviewNotice({
        to: candidate.email,
        candidateName: candidate.name,
        roleTitle: candidate.roleTitle
    });

    res.status(201).json({
        invite,
        email,
        emailResult
    });
});

app.get('/api/invites', (req, res) => {
    res.json(listInvites(req.query.roleId));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Recruitment API running on port ${PORT}`);
});

module.exports = app;
