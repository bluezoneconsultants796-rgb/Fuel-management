import React, { useCallback, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, ScreenHeader } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { StatusChip } from '../../components/StatusChip';
import { LoadingSpinner } from '../../components/Loading';
import { ErrorState } from '../../components/Feedback';
import { SlipImageModal } from '../../components/SlipImageModal';
import { getErrorMessage, getFuelEntry, updateFuelEntryStatus } from '../../services/fuelService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EntryStatus, FuelEntryDetail } from '../../types/models';
import { RootStackParamList } from '../../types/navigation';
import { formatDate, formatDateTime, formatLiters, formatMoney, formatRate, resolveFileUrl } from '../../utils/format';
import { colors, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryDetail'>;

export default function EntryDetailScreen({ route }: Props): React.JSX.Element {
  const { entryId } = route.params;
  const [entry, setEntry] = useState<FuelEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  // Only the office reviews entries; drivers just see the status.
  const canReview = user?.role === 'admin' || user?.role === 'accountant';

  const changeStatus = async (status: EntryStatus): Promise<void> => {
    setUpdatingStatus(true);
    try {
      await updateFuelEntryStatus(entryId, status);
      setEntry((current) => (current ? { ...current, status } : current));
      toast.success(`Entry marked as ${status}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      setEntry(await getFuelEntry(entryId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && !entry) {
    return (
      <Screen>
        <ScreenHeader title="Fuel Entry" />
        <LoadingSpinner label="Loading entry…" />
      </Screen>
    );
  }

  if (error || !entry) {
    return (
      <Screen>
        <ScreenHeader title="Fuel Entry" />
        <ErrorState message={error ?? 'Entry not found.'} onRetry={load} />
      </Screen>
    );
  }

  const slipUrl = resolveFileUrl(entry.slipImageUrl);
  const isImageSlip =
    /\.(png|jpe?g)($|\?)/i.test(entry.slipImageUrl) || /\.(png|jpe?g)$/i.test(entry.originalFileName ?? '');

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Date', value: formatDate(entry.date) },
    { label: 'Time', value: entry.time || '—' },
    { label: 'Driver', value: entry.driver?.name ?? '—' },
    { label: 'Vehicle', value: entry.vehicleNumber },
    { label: 'Petrol Pump', value: entry.petrolPumpName },
    { label: 'Fuel Type', value: entry.fuelType },
    { label: 'Liters', value: formatLiters(entry.liters) },
    { label: 'Price / Liter', value: formatRate(entry.pricePerLiter) },
    { label: 'Total Amount', value: formatMoney(entry.totalAmount) },
    { label: 'Receipt Number', value: entry.receiptNumber || '—' },
    { label: 'Saved On', value: formatDateTime(entry.createdAt) }
  ];

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <ScreenHeader title="Fuel Entry" subtitle={`Receipt #${entry.receiptNumber || '—'}`} />

      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.amount}>{formatMoney(entry.totalAmount)}</Text>
            <Text style={styles.amountSub}>
              {formatLiters(entry.liters)} • {entry.fuelType} • {formatDate(entry.date)}
            </Text>
          </View>
          <StatusChip status={entry.status} />
        </View>
        {entry.ocrConfidence !== null ? (
          <Text style={styles.ocrConfidence}>OCR confidence: {Math.round(entry.ocrConfidence)}%</Text>
        ) : null}
      </Card>

      {canReview ? (
        <Card style={styles.reviewCard}>
          <Text style={styles.slipTitle}>Office Review</Text>
          <View style={styles.reviewRow}>
            {entry.status !== 'verified' ? (
              <Button
                title="Verify"
                loading={updatingStatus}
                onPress={() => changeStatus('verified')}
                style={styles.reviewButton}
                icon={<Ionicons name="checkmark-circle-outline" size={16} color={colors.white} />}
              />
            ) : null}
            {entry.status !== 'rejected' ? (
              <Button
                title="Reject"
                variant="danger"
                loading={updatingStatus}
                onPress={() => changeStatus('rejected')}
                style={styles.reviewButton}
                icon={<Ionicons name="close-circle-outline" size={16} color={colors.white} />}
              />
            ) : null}
            {entry.status !== 'pending' ? (
              <Button
                title="Set Pending"
                variant="secondary"
                loading={updatingStatus}
                onPress={() => changeStatus('pending')}
                style={styles.reviewButton}
              />
            ) : null}
          </View>
          {entry.status === 'rejected' ? (
            <Text style={styles.reviewHint}>Rejected entries are excluded from dashboards and reports.</Text>
          ) : null}
        </Card>
      ) : null}

      <Card>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </Card>

      {slipUrl ? (
        <Card style={styles.slipCard}>
          <Text style={styles.slipTitle}>Original Slip</Text>
          {isImageSlip ? (
            <>
              <Image source={{ uri: slipUrl }} style={styles.slipImage} resizeMode="contain" />
              <Button
                title="View Full Slip"
                variant="secondary"
                onPress={() => setImageModalVisible(true)}
                style={{ marginTop: spacing.md }}
                icon={<Ionicons name="expand-outline" size={16} color={colors.primary} />}
              />
            </>
          ) : (
            <Button
              title="Open PDF Slip"
              variant="secondary"
              onPress={() => {
                Linking.openURL(slipUrl).catch(() =>
                  Linking.openURL(slipUrl)
                );
              }}
              icon={<Ionicons name="document-text-outline" size={16} color={colors.primary} />}
            />
          )}
        </Card>
      ) : null}

      <SlipImageModal visible={imageModalVisible} uri={slipUrl ?? ''} onClose={() => setImageModalVisible(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginBottom: spacing.lg
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  amount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary
  },
  amountSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4
  },
  ocrConfidence: {
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.sm
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  rowLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  rowValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md
  },
  reviewCard: {
    marginBottom: spacing.lg
  },
  reviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  reviewButton: {
    flexGrow: 1,
    flexBasis: '30%'
  },
  reviewHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm
  },
  slipCard: {
    marginBottom: spacing.xl
  },
  slipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md
  },
  slipImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: '#00000008'
  }
});