import { useEffect, useState } from 'react';
import { Box, Container, VStack, HStack, Text, Button, Grid, Spinner, Center, Alert } from '@chakra-ui/react';
import { RefreshCw } from 'lucide-react';
import BoardSDK from '@api/BoardSDK.js';
import CapacityBarometer from './components/CapacityBarometer';
import HoursTable from './components/HoursTable';
import DateFilter from './components/DateFilter';
import ContractContext from './components/ContractContext';
import BrandedBadge from './components/BrandedBadge';
import BillingBreakdown from './components/BillingBreakdown';
import WeeklySummaryTable from './components/WeeklySummaryTable';

const board = new BoardSDK();

const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    const suppressSDKErrors = (event) => {
      if (event.message?.includes('reportTime') || event.message?.includes('Command') && event.message?.includes('not supported')) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return true;
      }
    };
    window.addEventListener('error', suppressSDKErrors, true);
    return () => window.removeEventListener('error', suppressSDKErrors, true);
  }, []);

  const getThisMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return {
      from: new Date(year, month, 1),
      to: new Date(year, month + 1, 0),
      label: 'This Month'
    };
  };

  const [dateRange, setDateRange] = useState(getThisMonth());

  const getMonthCount = () => {
    if (!dateRange?.from || !dateRange?.to) return 1;
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
    return Math.max(1, months);
  };

  const monthCount = getMonthCount();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = board.items()
        .withColumns(['date', 'hourStarted', 'timeTracking'])
        .withSubItems(['status']);

      if (dateRange?.from && dateRange?.to) {
        const fromStr = toLocalDateStr(dateRange.from);
        const toStr = toLocalDateStr(dateRange.to);
        query = query.where({ date: { between: { from: fromStr, to: toStr } } });
      }

      let results;
      try {
        results = await query.execute();
      } catch (sdkError) {
        if (sdkError.message?.includes('reportTime') || sdkError.message?.includes('not supported')) {
          query = board.items()
            .withColumns(['date', 'hourStarted'])
            .withSubItems(['status']);
          if (dateRange?.from && dateRange?.to) {
            const fromStr = toLocalDateStr(dateRange.from);
            const toStr = toLocalDateStr(dateRange.to);
            query = query.where({ date: { between: { from: fromStr, to: toStr } } });
          }
          results = await query.execute();
          results.items = (results.items || []).map(item => ({
            ...item,
            timeTracking: { durationInSeconds: 0, isRunning: false, startedAt: null, history: [] }
          }));
        } else {
          throw sdkError;
        }
      }

      const fetchedItems = results.items || [];
      setItems(fetchedItems);
      const calculatedHours = fetchedItems.reduce((sum, item) => {
        return sum + (item.timeTracking?.durationInSeconds || 0) / 3600;
      }, 0);
      setTotalHours(calculatedHours);

    } catch (err) {
      console.error('Failed to fetch hours:', err);
      setError(err.message || 'Failed to load hours data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const handleExport = () => {
    if (items.length === 0) return;
    const csvData = [
      ['Date', 'Task', 'Start Time (SA)', 'Duration (hours)'],
      ...items.map(item => [
        item.date?.toLocaleDateString('en-GB') || '',
        item.name || '',
        item.hourStarted ? `${String(item.hourStarted.hour).padStart(2, '0')}:${String(item.hourStarted.minute).padStart(2, '0')}` : '',
        item.timeTracking ? (item.timeTracking.durationInSeconds / 3600).toFixed(2) : ''
      ])
    ];
    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `yoco-hours-export-${toLocalDateStr(new Date())}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box bg="#1A1C20" minH="100vh" py={8} fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">
      <Container maxW="6xl">
        <VStack gap={8} align="stretch">
          <HStack justify="space-between" align="start">
            <BrandedBadge name="Claudio | Yoco Dashboard" />
            <Button
              size="sm"
              bg="transparent"
              color="#ECEEF0"
              border="1px solid"
              borderColor="#343840"
              rounded="lg"
              fontWeight="600"
              _hover={{ bg: '#2A2E35', borderColor: '#2E9BD6' }}
              transition="all 0.2s"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          </HStack>

          <DateFilter value={dateRange} onChange={setDateRange} />

          {error && (
            <Alert.Root colorPalette="red" rounded="xl">
              <Alert.Indicator />
              <Alert.Title>Error</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Root>
          )}

          {loading ? (
            <Center p={8}>
              <Spinner size="lg" color="#2E9BD6" />
            </Center>
          ) : (
            <>
              <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
                <ContractContext
                  totalHours={totalHours}
                  dateRange={dateRange}
                  monthCount={monthCount}
                />
                <CapacityBarometer totalHours={totalHours} monthCount={monthCount} />
              </Grid>

              <BillingBreakdown totalHours={totalHours} monthCount={monthCount} />

              {monthCount === 1 && (
                <WeeklySummaryTable
                  items={items}
                  dateRange={dateRange}
                  onRefresh={fetchData}
                  totalHours={totalHours}
                />
              )}
            </>
          )}

          <HoursTable
            items={items}
            loading={loading}
            error={error}
            onExport={handleExport}
          />

          <Box
            bg="#22252A"
            px={6}
            py={3}
            rounded="lg"
            border="1px solid"
            borderColor="#343840"
            alignSelf="flex-end"
          >
            <Text fontSize="sm" fontWeight="600" color="#8A9099" letterSpacing="0.05em">
              ©GOALLOUNGE.TV - All Rights Reserved
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
