import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import { Clock, BarChart3 } from 'lucide-react';

const BillingBreakdown = ({ totalHours = 0, monthCount = 1 }) => {
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
              Hours Breakdown
            </Text>
            <Text fontSize="2xl" fontWeight="300" color="#ECEEF0" letterSpacing="-0.02em">
              Invoice Summary
            </Text>
          </VStack>
          <Box w="12" h="12" bg="rgba(120,197,245,0.08)" rounded="lg" border="1px solid rgba(120,197,245,0.15)"
            display="flex" alignItems="center" justifyContent="center">
            <BarChart3 size={22} color="#78C5F5" />
          </Box>
        </HStack>

        <VStack gap={3} align="stretch" p={4} bg="rgba(120,197,245,0.05)" rounded="lg" border="1px solid rgba(46,155,214,0.15)">
          <HStack justify="space-between">
            <HStack gap={2}>
              <Clock size={16} color="#2E9BD6" />
              <Text fontSize="sm" fontWeight="600" color="#2E9BD6">Hours Logged</Text>
            </HStack>
          </HStack>
          <HStack justify="space-between" align="baseline">
            <Text fontSize="xs" color="#8A9099">
              {monthCount > 1 ? `${monthCount} month period` : 'This period'}:
            </Text>
            <Text fontSize="2xl" fontWeight="300" color="#2E9BD6">{totalHours.toFixed(1)}h</Text>
          </HStack>
        </VStack>

        <Box pt={4} borderTop="1px solid" borderColor="#343840">
          <HStack justify="space-between" align="center">
            <Text fontSize="md" fontWeight="600" color="#8A9099">Total Billable:</Text>
            <Text fontSize="3xl" fontWeight="300" color="#ECEEF0" letterSpacing="-0.03em">
              {totalHours.toFixed(1)}h
            </Text>
          </HStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default BillingBreakdown;
