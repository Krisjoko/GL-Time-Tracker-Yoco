import { Box, VStack, Text, HStack, Badge, Center } from '@chakra-ui/react';
import { TrendingUp, CheckCircle } from 'lucide-react';

// Monthly cap: R36,400 ÷ R1,200/hr = 30.33h
const MONTHLY_CAP_HOURS = 36400 / 1200; // ~30.33h
const SCALE_MAX = 35; // a little headroom above cap

const CapacityBarometer = ({ totalHours = 0, monthCount = 1 }) => {
  const cap = MONTHLY_CAP_HOURS * monthCount;
  const scaleMax = SCALE_MAX * monthCount;
  const capPct = (cap / scaleMax) * 100;
  const filledPct = Math.min((totalHours / scaleMax) * 100, 100);
  const atCap = totalHours >= cap;
  const towardCap = Math.max(cap - totalHours, 0);

  const status = atCap
    ? { label: 'Cap Reached', color: '#D4C840', bgColor: 'rgba(212,200,64,0.10)', icon: TrendingUp }
    : { label: 'On Track',    color: '#2E9BD6', bgColor: 'rgba(46,155,214,0.10)',  icon: CheckCircle };

  const Icon = status.icon;

  return (
    <Box
      bg="#22252A"
      p={8}
      rounded="24px"
      border="1px solid"
      borderColor="#343840"
      _hover={{ borderColor: '#2E9BD6', boxShadow: '0 0 0 3px rgba(46,155,214,0.12)' }}
      transition="all 0.2s"
      fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
    >
      <VStack gap={6} align="stretch">

        <HStack justify="space-between" align="start">
          <VStack align="start" gap={1}>
            <Text fontSize="xs" fontWeight="600" color="#565C66" textTransform="uppercase" letterSpacing="0.1em">
              Capacity Status
            </Text>
            <Text fontSize="3xl" fontWeight="300" color="#ECEEF0" letterSpacing="-0.02em">
              {totalHours.toFixed(1)}h
            </Text>
          </VStack>
          <Center
            w="12" h="12"
            bg={status.bgColor}
            rounded="lg"
            border="1.5px solid"
            borderColor={status.color}
          >
            <Icon size={22} color={status.color} />
          </Center>
        </HStack>

        {/* Barometer */}
        <Box position="relative" pt={10} pb={8}>
          {/* Cap label */}
          <Box
            position="absolute"
            left={`${capPct}%`}
            transform="translateX(-50%)"
            top="-4px"
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap="4px"
          >
            <Text fontSize="11px" color="#D4C840" fontWeight="700" lineHeight="1.2">
              {cap.toFixed(1)}h
            </Text>
            <Text fontSize="9px" color="#565C66" fontWeight="500" lineHeight="1.2">cap</Text>
          </Box>

          {/* Track */}
          <Box position="relative" h="10px" rounded="full" overflow="hidden" bg="#1E2126">
            {/* Zone: below cap (blue tint) */}
            <Box position="absolute" left="0" top="0" h="full" w={`${capPct}%`} bg="rgba(46,155,214,0.12)" />
            {/* Zone: above cap (amber tint) */}
            <Box position="absolute" left={`${capPct}%`} top="0" h="full" w={`${100 - capPct}%`} bg="rgba(212,200,64,0.10)" />
            {/* Fill: below cap */}
            <Box
              position="absolute" left="0" top="0" h="full"
              w={`${Math.min(filledPct, capPct)}%`}
              bg="#2E9BD6" rounded="full" transition="width 0.4s ease"
            />
            {/* Fill: above cap */}
            {atCap && (
              <Box
                position="absolute" left={`${capPct}%`} top="0" h="full"
                w={`${Math.min(filledPct - capPct, 100 - capPct)}%`}
                bg="#D4C840" transition="width 0.4s ease"
              />
            )}
            {/* Cap marker line */}
            <Box
              position="absolute" left={`${capPct}%`} top="-2px"
              w="1.5px" h="14px" bg="#D4C840" opacity={0.8}
              transform="translateX(-50%)" zIndex={2}
            />
          </Box>

          <Text position="absolute" left="0" bottom="0" fontSize="10px" color="#565C66" fontWeight="600">0h</Text>
        </Box>

        {/* Status badge */}
        <Badge
          bg={status.bgColor} color={status.color}
          border="1px solid" borderColor={status.color}
          px={3} py={1.5} rounded="full" fontSize="sm" fontWeight="600"
          alignSelf="flex-start"
        >
          <HStack gap={2}>
            <Icon size={13} color={status.color} />
            <Text>{status.label}</Text>
          </HStack>
        </Badge>

        {/* Stats */}
        <VStack gap={0} align="stretch" borderTop="1px solid" borderColor="#343840" pt={4}>
          <HStack justify="space-between" py={2.5} borderBottom="1px solid" borderColor="#2A2E35">
            <Text fontSize="xs" color="#8A9099" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em">
              Hours to cap
            </Text>
            <Text fontSize="lg" fontWeight="700" color={atCap ? '#D4C840' : '#ECEEF0'}>
              {atCap ? '✓ Reached' : `${towardCap.toFixed(1)}h`}
            </Text>
          </HStack>
          <HStack justify="space-between" py={2.5}>
            <Text fontSize="xs" color="#8A9099" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em">
              Monthly cap
            </Text>
            <Text fontSize="xs" color="#8A9099" fontWeight="600">
              {cap.toFixed(1)}h · R{(36400 * monthCount).toLocaleString('en-ZA')}
            </Text>
          </HStack>
        </VStack>

      </VStack>
    </Box>
  );
};

export default CapacityBarometer;
