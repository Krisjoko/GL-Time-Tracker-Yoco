import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, VStack, HStack, Table, Badge, Text, Button, Input } from '@chakra-ui/react';
import { CheckCircle, Clock } from 'lucide-react';
import { storage } from '@api/monday-storage';

const YOCO_XERO_SERVER = 'https://gltv-yoco-xero-server.vercel.app';

const WeeklySummaryTable = ({ items = [], dateRange, onRefresh, totalHours = 0 }) => {
  const [loading, setLoading] = useState(true);
  const [monthApproved, setMonthApproved] = useState(false);
  const [approvalData, setApprovalData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [xeroSubmitted, setXeroSubmitted] = useState(false);

  // Name prompt
  const [showPrompt, setShowPrompt] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approving, setApproving] = useState(false);
  const nameInputRef = useRef(null);

  const getKeys = useCallback(() => {
    if (!dateRange?.from) return {};
    const y = dateRange.from.getFullYear();
    const m = dateRange.from.getMonth();
    return {
      approvalKey: `yoco_month_approval_${y}_${m}`,
      xeroKey: `yoco_xero_submitted_${y}_${m}`
    };
  }, [dateRange]);

  const loadState = useCallback(async () => {
    const { approvalKey, xeroKey } = getKeys();
    if (!approvalKey) return;
    try {
      const { value: approval } = await storage().key(approvalKey).get();
      const { value: xeroStatus } = await storage().key(xeroKey).get();
      setMonthApproved(approval?.approved || false);
      setApprovalData(approval || null);
      setXeroSubmitted(xeroStatus || false);
    } catch (err) {
      console.error('Failed to load state:', err);
    } finally {
      setLoading(false);
    }
  }, [getKeys]);

  useEffect(() => {
    if (dateRange?.from) loadState();
  }, [dateRange, loadState]);

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
          ? sum + (item.timeTracking?.durationInSeconds || 0) / 3600 : sum;
      }, 0);

      if (!(daysInWeek === 1 && weekHours === 0 && currentDay === 1)) {
        weeks.push({ weekNum, start: weekStart, end: weekEnd, hours: weekHours });
      }
      currentDay += daysInWeek;
      weekNum++;
    }
    return weeks.map((w, i) => ({ ...w, weekNum: i + 1 }));
  };

  const weeks = getWeeklyBreakdown();

  const getBillingPeriod = () => {
    if (!dateRange?.from || !dateRange?.to) return 'Current Period';
    const opts = { day: 'numeric', month: 'short' };
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    return `${from.toLocaleDateString('en-GB', opts)} → ${to.toLocaleDateString('en-GB', opts)} (${to.getFullYear()})`;
  };

  const handleApprove = async () => {
    const userName = approverName.trim();
    if (!userName) { nameInputRef.current?.focus(); return; }
    setApproving(true);
    try {
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2,'0')}|${String(now.getMonth()+1).padStart(2,'0')}|${now.getFullYear()} @${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const data = { approved: true, by: userName, at: timestamp };
      const { approvalKey } = getKeys();
      await storage().key(approvalKey).set(data);
      setMonthApproved(true);
      setApprovalData(data);
      setShowPrompt(false);
    } catch (err) {
      alert('Failed to save approval. Please try again.');
    } finally {
      setApproving(false);
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ totalHours: parseFloat(totalHours.toFixed(2)), billingPeriod }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let err = null;
        try { err = await response.json(); } catch { /* ignore */ }
        alert(`❌ Server error (${response.status}): ${err?.error || 'Unknown error'}`);
        return;
      }
      const result = await response.json();
      if (result.success) {
        const { xeroKey } = getKeys();
        await storage().key(xeroKey).set(true);
        setXeroSubmitted(true);
        alert(`✅ Draft invoice created — ${result.invoiceNumber || 'N/A'} for ${totalHours.toFixed(1)}h (${billingPeriod}). Review and send from Xero drafts.`);
        onRefresh?.();
      } else {
        alert(`❌ Could not create invoice: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('❌ Timed out. Please wait a moment and try again.');
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
        <Text fontSize="sm" fontWeight="600" color="#ECEEF0" textTransform="uppercase" letterSpacing="0.1em">
          Weekly Summary
        </Text>

        <Table.Root size="sm" style={{ background: 'transparent', borderCollapse: 'separate', borderSpacing: 0 }}>
          <Table.Header style={{ background: 'transparent' }}>
            <Table.Row style={{ background: '#1E2126' }} borderColor="#2E3138">
              <Table.ColumnHeader fontWeight="600" color="#565C66" fontSize="xs" textTransform="uppercase">Period</Table.ColumnHeader>
              <Table.ColumnHeader fontWeight="600" color="#565C66" fontSize="xs" textTransform="uppercase">Dates</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end" fontWeight="600" color="#565C66" fontSize="xs" textTransform="uppercase">Hours</Table.ColumnHeader>
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
              </Table.Row>
            ))}

            {/* Final month row */}
            <Table.Row style={{ background: '#1A1C20' }} borderTop="1px solid" borderColor="#343840">
              <Table.Cell colSpan={2} fontWeight="700" fontSize="md" color="#ECEEF0">Total</Table.Cell>
              <Table.Cell textAlign="end">
                <Text fontSize="xl" color="#ECEEF0" fontWeight="800">{totalHours.toFixed(1)}h</Text>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>

        {/* Single approval + Xero section */}
        <Box pt={2} borderTop="1px solid" borderColor="#343840">
          {!monthApproved ? (
            <HStack justify="flex-end">
              <Button
                size="sm" bg="#2E9BD6" color="white" border="none" rounded="lg"
                fontWeight="700" _hover={{ bg: '#1A6FA8' }} transition="all 0.2s"
                onClick={() => { setApproverName(''); setShowPrompt(true); setTimeout(() => nameInputRef.current?.focus(), 50); }}
              >
                Approve Month →
              </Button>
            </HStack>
          ) : (
            <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
              <Box bg="rgba(120,197,245,0.08)" border="1px solid" borderColor="rgba(46,155,214,0.3)"
                rounded="lg" px={3} py={2} display="inline-flex" alignItems="flex-start" gap={2}>
                <CheckCircle size={16} color="#2E9BD6" style={{ flexShrink: 0, marginTop: '2px' }} />
                <VStack align="start" gap={0.5}>
                  <Text fontSize="xs" fontWeight="700" color="#2E9BD6">Approved</Text>
                  {approvalData?.by && <Text fontSize="xs" color="#8A9099">by {approvalData.by}</Text>}
                  {approvalData?.at && <Text fontSize="xs" color="#565C66">{approvalData.at}</Text>}
                </VStack>
              </Box>

              {!xeroSubmitted ? (
                <button
                  onClick={handleXeroSubmit}
                  disabled={submitting}
                  style={{
                    background: submitting ? '#1A6FA8' : '#2E9BD6', color: '#FFF', border: 'none',
                    borderRadius: '20px', padding: '6px 16px', fontSize: '13px',
                    fontFamily: 'Helvetica Neue, sans-serif', fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                  {submitting ? (
                    <><span style={{ width: '10px', height: '10px', border: '2px solid #fff',
                      borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block',
                      animation: 'spin 0.8s linear infinite' }} />Submitting...</>
                  ) : 'Submit to Xero →'}
                </button>
              ) : (
                <Badge bg="rgba(46,214,100,0.15)" color="#4CD47A" border="1px solid rgba(46,214,100,0.3)"
                  fontSize="xs" fontWeight="600" px={3} py={1.5} rounded="full">
                  ✅ Submitted to Xero
                </Badge>
              )}
            </HStack>
          )}
        </Box>
      </VStack>

      {/* Approval modal */}
      {showPrompt && (
        <Box position="fixed" inset="0" bg="rgba(0,0,0,0.7)" zIndex={1000}
          display="flex" alignItems="center" justifyContent="center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPrompt(false); }}>
          <Box bg="#22252A" border="1px solid" borderColor="#343840" rounded="xl" p={6} w="340px" shadow="2xl">
            <VStack gap={4} align="stretch">
              <VStack gap={1} align="start">
                <Text fontSize="md" fontWeight="700" color="#ECEEF0">Approve {getBillingPeriod()}</Text>
                <Text fontSize="sm" color="#8A9099">
                  Enter your name to confirm approval for {totalHours.toFixed(1)}h. This cannot be undone.
                </Text>
              </VStack>
              <Input
                ref={nameInputRef} placeholder="Your name" value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApprove(); if (e.key === 'Escape') setShowPrompt(false); }}
                bg="#1A1C20" border="1px solid" borderColor="#343840" color="#ECEEF0"
                _placeholder={{ color: '#565C66' }} _focus={{ borderColor: '#2E9BD6', outline: 'none' }}
                rounded="lg" px={3} py={2} fontSize="sm"
              />
              <HStack gap={3} justify="flex-end">
                <Button size="sm" bg="transparent" color="#8A9099" border="1px solid" borderColor="#343840"
                  rounded="lg" fontWeight="600" _hover={{ bg: '#2A2E35', color: '#ECEEF0' }}
                  onClick={() => setShowPrompt(false)} disabled={approving}>
                  Cancel
                </Button>
                <Button size="sm" bg={approverName.trim() ? '#2E9BD6' : '#2A2E35'} color="white"
                  border="none" rounded="lg" fontWeight="700"
                  _hover={{ bg: approverName.trim() ? '#1A6FA8' : '#2A2E35' }}
                  onClick={handleApprove} disabled={!approverName.trim() || approving}>
                  {approving ? 'Saving…' : 'Confirm Approval'}
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
