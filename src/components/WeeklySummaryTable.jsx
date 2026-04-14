import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, VStack, HStack, Table, Badge, Text, Button, Input } from '@chakra-ui/react';
import { CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { storage } from '@api/monday-storage';

const YOCO_XERO_SERVER = 'https://gltv-yoco-xero-server.vercel.app';

const WeeklySummaryTable = ({ items = [], dateRange, onRefresh, totalHours = 0 }) => {
  const [weekApprovals, setWeekApprovals] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [xeroSubmitted, setXeroSubmitted] = useState(false);

  const [namePrompt, setNamePrompt] = useState(null);
  const [approverName, setApproverName] = useState('');
  const [approvingWeek, setApprovingWeek] = useState(false);
  const nameInputRef = useRef(null);

  const loadApprovals = useCallback(async (showSyncSpinner = false) => {
    if (!dateRange?.from) return;
    if (showSyncSpinner) setSyncing(true);
    const monthKey = `yoco_week_approvals_${dateRange.from.getFullYear()}_${dateRange.from.getMonth()}`;
    const xeroKey = `yoco_xero_submitted_${dateRange.from.getFullYear()}_${dateRange.from.getMonth()}`;
    try {
      const { value } = await storage().key(monthKey).get();
      setWeekApprovals(value || {});
      const { value: xeroStatus } = await storage().key(xeroKey).get();
      setXeroSubmitted(xeroStatus || false);
    } catch (err) {
      console.error('Failed to load week approvals:', err);
      setWeekApprovals({});
      setXeroSubmitted(false);
    } finally {
      setLoading(false);
      if (showSyncSpinner) setSyncing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (dateRange?.from) loadApprovals();
  }, [dateRange, loadApprovals]);

  const getWeeklyBreakdown = () => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const weeks = [];
    const year = dateRange.from.getFullYear();
    const month = dateRange.from.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    let weekNum = 1;
    let currentDay = 1;

    while (currentDay <= lastDay) {
      const weekStart = new Date(year, month, currentDay);
      const dow = weekStart.getDay();
      let daysInWeek = weekNum === 1 ? (dow === 0 ? 1 : (7 - dow)) : 7;
      daysInWeek = Math.min(daysInWeek, lastDay - currentDay + 1);
      const weekEnd = new Date(year, month, currentDay + daysInWeek - 1);

      const weekHours = items.reduce((sum, item) => {
        const d = new Date(item.date);
        return (d >= weekStart && d <= weekEnd)
          ? sum + (item.timeTracking?.durationInSeconds || 0) / 3600
          : sum;
      }, 0);

      if (!(daysInWeek === 1 && weekHours === 0 && currentDay === 1)) {
        const weekKeyDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        const weekKey = `week_${weekKeyDate}`;
        const approvalData = weekApprovals[weekKey];
        weeks.push({
          weekNum, weekKey, start: weekStart, end: weekEnd, hours: weekHours,
          approved: approvalData?.approved || false,
          by: approvalData?.by, userId: approvalData?.userId, at: approvalData?.at
        });
      }
      currentDay += daysInWeek;
      weekNum++;
    }
    return weeks.map((w, i) => ({ ...w, weekNum: i + 1 }));
  };

  const weeks = getWeeklyBreakdown();
  const allWeeksApproved = weeks.length > 0 && weeks.every(w => w.approved);

  // Format billing period as "Apr 1 → Apr 30 (2026)"
  const getBillingPeriod = () => {
    if (!dateRange?.from || !dateRange?.to) return 'Current Period';
    const opts = { day: 'numeric', month: 'short' };
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const fromStr = from.toLocaleDateString('en-GB', opts);
    const toStr = to.toLocaleDateString('en-GB', opts);
    const year = to.getFullYear();
    return `${fromStr} → ${toStr} (${year})`;
  };

  const openNamePrompt = (weekNum, weekKey) => {
    const existing = weekApprovals[weekKey];
    if (existing?.approved) {
      alert(`Already approved by ${existing.by} on ${existing.at}. Locked.`);
      return;
    }
    setApproverName('');
    setNamePrompt({ weekNum, weekKey });
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleWeekApprove = async () => {
    if (!namePrompt) return;
    const { weekNum, weekKey } = namePrompt;
    const userName = approverName.trim();
    if (!userName) { nameInputRef.current?.focus(); return; }

    setApprovingWeek(true);
    try {
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2,'0')}|${String(now.getMonth()+1).padStart(2,'0')}|${now.getFullYear()} @${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const monthKey = `yoco_week_approvals_${dateRange.from.getFullYear()}_${dateRange.from.getMonth()}`;
      const newApprovals = { ...weekApprovals, [weekKey]: { approved: true, by: userName, userId: null, at: timestamp } };
      await storage().key(monthKey).set(newApprovals);
      setWeekApprovals(newApprovals);
      setNamePrompt(null);
      await loadApprovals();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save approval:', err);
      alert('Failed to save approval. Please try again.');
    } finally {
      setApprovingWeek(false);
    }
  };

  const handleXeroSubmit = async () => {
    if (submitting || xeroSubmitted) return;
    setSubmitting(true);
    const billingPeriod = getBillingPeriod();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${YOCO_XERO_SERVER}/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          totalHours: parseFloat(totalHours.toFixed(2)),
          billingPeriod,
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData = null;
        try { errorData = await response.json(); } catch { /* ignore */ }
        alert(`❌ Server error (${response.status}): ${errorData?.error || 'Unknown error'}`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        const xeroKey = `yoco_xero_submitted_${dateRange.from.getFullYear()}_${dateRange.from.getMonth()}`;
        await storage().key(xeroKey).set(true);
        setXeroSubmitted(true);
        await loadApprovals();
        alert(`✅ Draft invoice created in Xero — ${result.invoiceNumber || 'N/A'} for ${totalHours.toFixed(1)}h (${billingPeriod}). Review and send from your Xero drafts.`);
        onRefresh?.();
      } else {
        alert(`❌ Could not create invoice: ${result.error || 'Unknown error'}.`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('❌ Request timed out after 60 seconds. Please wait a moment and try again.');
      } else {
        alert(`❌ Network error: ${err.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || weeks.length === 0) return null;

  return (
    <Box bg="#22252A" p={6} rounded="lg" border="1px solid" borderColor="#343840"
      fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <VStack gap={4} align="stretch">
        <HStack justify="space-between" align="center">
          <Text fontSize="sm" fontWeight="600" color="#ECEEF0" textTransform="uppercase" letterSpacing="0.1em">
            Weekly Approval Summary
          </Text>
          <Button
            size="xs" bg="transparent" color="#565C66" border="1px solid" borderColor="#343840"
            rounded="md" fontWeight="600" _hover={{ bg: '#2A2E35', color: '#ECEEF0', borderColor: '#2E9BD6' }}
            transition="all 0.2s" onClick={() => loadApprovals(true)} disabled={syncing}
          >
            <RefreshCw size={12} style={syncing ? { animation: 'spin 0.8s linear infinite' } : {}} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
        </HStack>

        <Table.Root size="sm" style={{ background: 'transparent', borderCollapse: 'separate', borderSpacing: 0 }}>
          <Table.Header style={{ background: 'transparent' }}>
            <Table.Row style={{ background: '#1E2126' }} borderColor="#2E3138">
              <Table.ColumnHeader fontWeight="600" color="#565C66" fontSize="xs" textTransform="uppercase">Period</Table.ColumnHeader>
              <Table.ColumnHeader fontWeight="600" color="#565C66" fontSize="xs" textTransform="uppercase">Dates</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end" fontWeight="600" color="#565C66" fontSize="xs" textTransform="uppercase">Hours</Table.ColumnHeader>
              <Table.ColumnHeader fontWeight="600" color="#565C66" fontSize="xs" textTransform="uppercase">Status</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end" fontWeight="600" color="#565C66" fontSize="xs" textTransform="uppercase">Action</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body style={{ background: 'transparent' }}>
            {weeks.map((week) => (
              <Table.Row key={week.weekNum} style={{ background: '#22252A' }} _hover={{ bg: '#2A2E35' }} borderColor="#2E3138">
                <Table.Cell fontWeight="600" color="#ECEEF0">Week {week.weekNum}</Table.Cell>
                <Table.Cell fontSize="sm" color="#8A9099">
                  {week.start.getDate()} {week.start.toLocaleDateString('en-US', { month: 'short' })} – {week.end.getDate()} {week.end.toLocaleDateString('en-US', { month: 'short' })}
                </Table.Cell>
                <Table.Cell textAlign="end" fontWeight="700" color="#ECEEF0">{week.hours.toFixed(1)}h</Table.Cell>
                <Table.Cell>
                  {week.approved ? (
                    <Box bg="rgba(120,197,245,0.08)" border="1px solid" borderColor="rgba(46,155,214,0.3)" rounded="lg"
                      px={3} py={2} display="inline-flex" alignItems="flex-start" gap={2} maxW="220px">
                      <CheckCircle size={16} color="#2E9BD6" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <VStack align="start" gap={0.5} minW={0}>
                        <Text fontSize="xs" fontWeight="700" color="#2E9BD6" lineHeight="1.2">Approved</Text>
                        {week.by && <Text fontSize="xs" color="#8A9099" lineHeight="1.2">by {week.by}</Text>}
                        {week.at && <Text fontSize="xs" color="#565C66" lineHeight="1.2">{week.at}</Text>}
                      </VStack>
                    </Box>
                  ) : (
                    <Badge bg="rgba(245,240,144,0.1)" color="#D4C840" border="1px solid rgba(212,200,64,0.3)"
                      px={3} py={1.5} rounded="full" fontSize="xs" fontWeight="600">
                      <HStack gap={1.5}><Clock size={12} /><Text>Pending</Text></HStack>
                    </Badge>
                  )}
                </Table.Cell>
                <Table.Cell textAlign="end">
                  {!week.approved && (
                    <Button size="sm" bg="#2E9BD6" color="white" border="none" rounded="lg" fontWeight="700"
                      _hover={{ bg: '#1A6FA8' }} transition="all 0.2s"
                      onClick={() => openNamePrompt(week.weekNum, week.weekKey)}>
                      Approve W{week.weekNum}
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}

            {/* Final row */}
            <Table.Row style={{ background: '#1A1C20' }} borderTop="1px solid" borderColor="#343840">
              <Table.Cell colSpan={2} fontWeight="700" fontSize="md" color="#ECEEF0">Final Month</Table.Cell>
              <Table.Cell textAlign="end">
                <Text fontSize="xl" color="#ECEEF0" fontWeight="800">{totalHours.toFixed(1)}h</Text>
              </Table.Cell>
              <Table.Cell>
                <HStack gap={3}>
                  {allWeeksApproved ? (
                    <Badge bg="rgba(120,197,245,0.1)" color="#2E9BD6" border="1px solid rgba(46,155,214,0.3)"
                      fontSize="xs" fontWeight="600" px={3} py={1.5} rounded="full">
                      <HStack gap={1}><CheckCircle size={11} /><Text>Complete</Text></HStack>
                    </Badge>
                  ) : (
                    <Badge bg="rgba(240,160,160,0.1)" color="#E04040" border="1px solid rgba(224,64,64,0.3)"
                      fontSize="xs" fontWeight="600" px={3} py={1.5} rounded="full">
                      Incomplete
                    </Badge>
                  )}

                  {allWeeksApproved && !xeroSubmitted && (
                    <button
                      onClick={handleXeroSubmit}
                      disabled={submitting}
                      style={{
                        background: submitting ? '#1A6FA8' : '#2E9BD6', color: '#FFFFFF', border: 'none',
                        borderRadius: '20px', padding: '4px 14px', fontSize: '12px',
                        fontFamily: 'Helvetica Neue, sans-serif', fontWeight: '600',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
                      }}>
                      {submitting ? (
                        <><span style={{ width: '10px', height: '10px', border: '2px solid #fff',
                          borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block',
                          animation: 'spin 0.8s linear infinite' }} />Submitting...</>
                      ) : 'Submit to Xero →'}
                    </button>
                  )}

                  {allWeeksApproved && xeroSubmitted && (
                    <Badge bg="rgba(46,214,100,0.15)" color="#4CD47A" border="1px solid rgba(46,214,100,0.3)"
                      fontSize="xs" fontWeight="600" px={3} py={1.5} rounded="full">
                      ✅ Submitted
                    </Badge>
                  )}
                </HStack>
              </Table.Cell>
              <Table.Cell />
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </VStack>

      {/* Name prompt modal */}
      {namePrompt && (
        <Box position="fixed" inset="0" bg="rgba(0,0,0,0.7)" zIndex={1000}
          display="flex" alignItems="center" justifyContent="center"
          onClick={(e) => { if (e.target === e.currentTarget) setNamePrompt(null); }}>
          <Box bg="#22252A" border="1px solid" borderColor="#343840" rounded="xl" p={6} w="340px" shadow="2xl">
            <VStack gap={4} align="stretch">
              <VStack gap={1} align="start">
                <Text fontSize="md" fontWeight="700" color="#ECEEF0">Approve Week {namePrompt.weekNum}</Text>
                <Text fontSize="sm" color="#8A9099">Enter your name to confirm. This cannot be undone.</Text>
              </VStack>
              <Input
                ref={nameInputRef} placeholder="Your name" value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleWeekApprove(); if (e.key === 'Escape') setNamePrompt(null); }}
                bg="#1A1C20" border="1px solid" borderColor="#343840" color="#ECEEF0"
                _placeholder={{ color: '#565C66' }} _focus={{ borderColor: '#2E9BD6', outline: 'none' }}
                rounded="lg" px={3} py={2} fontSize="sm"
              />
              <HStack gap={3} justify="flex-end">
                <Button size="sm" bg="transparent" color="#8A9099" border="1px solid" borderColor="#343840"
                  rounded="lg" fontWeight="600" _hover={{ bg: '#2A2E35', color: '#ECEEF0' }}
                  onClick={() => setNamePrompt(null)} disabled={approvingWeek}>
                  Cancel
                </Button>
                <Button size="sm" bg={approverName.trim() ? '#2E9BD6' : '#2A2E35'} color="white"
                  border="none" rounded="lg" fontWeight="700"
                  _hover={{ bg: approverName.trim() ? '#1A6FA8' : '#2A2E35' }}
                  onClick={handleWeekApprove} disabled={!approverName.trim() || approvingWeek}>
                  {approvingWeek ? 'Saving…' : 'Confirm Approval'}
                </Button>
              </HStack>
            </VStack>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default WeeklySummaryTable;
