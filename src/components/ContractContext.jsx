import { Box, VStack, Text, HStack, Separator } from '@chakra-ui/react';
import { Calendar, Clock, TrendingUp, Target } from 'lucide-react';

// Yoco contract: 7hrs/week — Mon 2h | Thu 1h | Sat 4h
const WEEKLY_TARGET = 7;
const HOURLY_RATE = 1200;

const SESSION_SCHEDULE = [
  { day: 'Monday',   time: '11:00–13:00 SA', hours: 2, note: 'Jam session with MJ' },
  { day: 'Thursday', time: '13:00–14:00 SA', hours: 1, note: 'Review with Yannick, Dean + stakeholders' },
  { day: 'Saturday', time: '09:00–12:00 SA', hours: 4, note: 'Focused craft time (async)' },
];

const ContractContext = ({ totalHours = 0, dateRange = {}, monthCount = 1 }) => {
  const now = new Date();
  const selectedDate = dateRange?.from ? new Date(dateRange.from) : now;
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();

  const getWeeksInMonth = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Math.round(daysInMonth / 7);
  };

  const weeksInMonth = monthCount === 1
    ? getWeeksInMonth(selectedYear, selectedMonth)
    : monthCount * getWeeksInMonth(selectedYear, selectedMonth);

  const expectedHours = weeksInMonth * WEEKLY_TARGET;
  const loggedValue = totalHours * HOURLY_RATE;
  const remainingHours = Math.max(expectedHours - totalHours, 0);
  const progressPct = expectedHours > 0 ? Math.min((totalHours / expectedHours) * 100, 100) : 0;

  const iconBox = (Icon) => (
    <Box w="8" h="8" bg="rgba(120,197,245,0.08)" rounded="lg" border="1px solid rgba(120,197,245,0.15)"
      display="flex" alignItems="center" justifyContent="center">
      <Icon size={15} color="#78C5F5" />
    </Box>
  );

  const cardStyle = {
    bg: '#22252A', p: 8, rounded: '24px', border: '1px solid', borderColor: '#343840',
    _hover: { borderColor: '#2E9BD6', boxShadow: '0 0 0 3px rgba(46,155,214,0.12)' },
    transition: 'all 0.2s', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
  };

  const labelStyle = { fontSize: 'sm', fontWeight: '600', color: '#8A9099' };
  const valueStyle = { fontSize: '2xl', fontWeight: '300', color: '#ECEEF0' };

  return (
    <Box {...cardStyle}>
      <VStack gap={6} align="stretch">

        <HStack justify="space-between" align="start">
          <VStack align="start" gap={1}>
            <Text fontSize="xs" fontWeight="600" color="#565C66" letterSpacing="0.1em" textTransform="uppercase">
              Contract Context
            </Text>
            <Text fontSize="2xl" fontWeight="300" color="#ECEEF0" letterSpacing="-0.02em">
              7hrs / week
            </Text>
          </VStack>
          <Box w="12" h="12" bg="rgba(120,197,245,0.08)" rounded="lg" border="1px solid rgba(120,197,245,0.15)"
            display="flex" alignItems="center" justifyContent="center">
            <Target size={22} color="#78C5F5" />
          </Box>
        </HStack>

        {/* Session schedule */}
        <Box bg="#1A1C20" rounded="xl" p={4} border="1px solid" borderColor="#2A2E35">
          <Text fontSize="xs" fontWeight="600" color="#565C66" textTransform="uppercase" letterSpacing="0.08em" mb={3}>
            Weekly Schedule
          </Text>
          <VStack gap={2} align="stretch">
            {SESSION_SCHEDULE.map((s, i) => (
              <HStack key={i} justify="space-between" align="start">
                <VStack align="start" gap={0}>
                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="700" color="#ECEEF0">{s.day}</Text>
                    <Text fontSize="xs" color="#565C66">{s.time}</Text>
                  </HStack>
                  <Text fontSize="xs" color="#8A9099">{s.note}</Text>
                </VStack>
                <Text fontSize="sm" fontWeight="700" color="#2E9BD6" whiteSpace="nowrap">{s.hours}h</Text>
              </HStack>
            ))}
          </VStack>
        </Box>

        {/* Metrics */}
        <VStack gap={0} align="stretch">
          {[
            { icon: Calendar,    label: 'Weeks in period',  value: `${weeksInMonth}` },
            { icon: Target,      label: 'Expected hours',   value: `${expectedHours}h`, valueColor: '#2E9BD6',
              sub: `${weeksInMonth} weeks × ${WEEKLY_TARGET}h` },
            { icon: Clock,       label: 'Hours logged',     value: `${totalHours.toFixed(1)}h` },
            { icon: Clock,       label: 'Remaining',        value: `${remainingHours.toFixed(1)}h`,
              valueColor: remainingHours === 0 ? '#2E9BD6' : '#ECEEF0' },
            { icon: TrendingUp,  label: 'Period value',     value: `R${loggedValue.toLocaleString('en-ZA')}`,
              sub: `R${HOURLY_RATE}/hr`, valueColor: '#2E9BD6' },
          ].map(({ icon: Icon, label, sub, value, valueColor }, i, arr) => (
            <Box key={label}>
              <HStack justify="space-between" align="center" py={3}>
                <HStack gap={3}>
                  {iconBox(Icon)}
                  <VStack align="start" gap={0}>
                    <Text {...labelStyle}>{label}</Text>
                    {sub && <Text fontSize="xs" color="#565C66">{sub}</Text>}
                  </VStack>
                </HStack>
                <Text {...valueStyle} color={valueColor || '#ECEEF0'}>{value}</Text>
              </HStack>
              {i < arr.length - 1 && <Separator borderColor="#2A2E35" />}
            </Box>
          ))}
        </VStack>

        {/* Progress bar */}
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="xs" color="#565C66">Period progress</Text>
            <Text fontSize="xs" fontWeight="700" color="#2E9BD6">{progressPct.toFixed(0)}%</Text>
          </HStack>
          <Box h="4px" bg="#2A2E35" rounded="full">
            <Box h="4px" bg="#2E9BD6" rounded="full" w={`${progressPct}%`} transition="width 0.4s ease" />
          </Box>
        </Box>

      </VStack>
    </Box>
  );
};

export default ContractContext;
