let candidateId = 1;

const candidates = [];
const interviewInvites = [];

function saveCandidate(candidateData) {
  const candidate = {
    id: candidateId++,
    ...candidateData,
    createdAt: new Date().toISOString()
  };

  candidates.unshift(candidate);
  return candidate;
}

function listCandidates(roleId = null) {
  if (!roleId) {
    return candidates;
  }

  return candidates.filter(candidate => candidate.roleId === roleId);
}

function getCandidate(candidateId) {
  const id = Number(candidateId);

  return candidates.find(candidate => candidate.id === id);
}

function postInvite(candidate, details = {}) {
  const invite = {
    id: interviewInvites.length + 1,
    candidateId: candidate.id,
    roleId: candidate.roleId,
    name: candidate.name,
    email: candidate.email,
    createdAt: new Date().toISOString(),
    ...details
  };

  interviewInvites.unshift(invite);
  return invite;
}

function listInvites(roleId = null) {
  if (!roleId) {
    return interviewInvites;
  }

  return interviewInvites.filter(invite => invite.roleId === roleId);
}

module.exports = {
  saveCandidate,
  listCandidates,
  getCandidate,
  postInvite,
  listInvites
};
