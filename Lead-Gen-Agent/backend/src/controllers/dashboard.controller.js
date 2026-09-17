'use strict';

const { leads: leadsRepo, campaigns: campaignsRepo, messages: messagesRepo } = require('../../../database');
const n8n = require('../services/n8n');

/** Everything the dashboard screen needs, in one round trip. */
async function summary(req, res) {
  const byStatus = Object.fromEntries(leadsRepo.countByStatus().map((r) => [r.status, r.n]));
  const msgByStatus = Object.fromEntries(messagesRepo.countByStatus().map((r) => [r.status, r.n]));
  const campaigns = campaignsRepo.listWithStats();

  const totalLeads = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const contacted = (byStatus.contacted || 0) + (byStatus.replied || 0) + (byStatus.qualified || 0) + (byStatus.won || 0);
  const replied = msgByStatus.replied || 0;
  const delivered = (msgByStatus.sent || 0) + (msgByStatus.delivered || 0);

  res.json({
    ok: true,
    totals: {
      leads: totalLeads,
      contacted,
      replied,
      qualified: byStatus.qualified || 0,
      won: byStatus.won || 0,
      messagesSent: delivered,
      messagesFailed: msgByStatus.failed || 0,
      replyRate: delivered ? Number(((replied / delivered) * 100).toFixed(1)) : 0,
    },
    leadsByStatus: byStatus,
    leadsByDay: leadsRepo.countByDay(14),
    channels: messagesRepo.countByChannel(),
    activeCampaigns: campaigns.filter((c) => c.status === 'running').length,
    campaigns: campaigns.slice(0, 5),
    recentMessages: messagesRepo.recent(10),
    n8n: n8n.status(),
  });
}

module.exports = { summary };
