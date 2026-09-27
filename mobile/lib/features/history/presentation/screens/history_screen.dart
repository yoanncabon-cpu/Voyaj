import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/app_theme.dart';
import '../../../ride_instant/data/models/ride_model.dart';
import '../../../ride_instant/data/repositories/ride_repository.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    // TODO: replace with proper provider using current UID
    final historyAsync = ref.watch(rideHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Historique')),
      body: historyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur : $e')),
        data: (rides) {
          if (rides.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.history_rounded,
                      size: 64, color: colorScheme.onSurfaceVariant),
                  const SizedBox(height: 16),
                  Text(
                    'Aucun trajet pour l\'instant',
                    style: theme.textTheme.bodyLarge?.copyWith(
                        color: colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rides.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final ride = rides[index];
              return _RideHistoryCard(
                ride: ride,
                onTap: () {}, // TODO: détail de la course
              );
            },
          );
        },
      ),
    );
  }
}

class _RideHistoryCard extends StatelessWidget {
  final RideModel ride;
  final VoidCallback onTap;

  const _RideHistoryCard({required this.ride, required this.onTap});

  Color _statusColor(RideStatus status) {
    switch (status) {
      case RideStatus.confirmed:
        return Colors.green;
      case RideStatus.cancelled:
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  String _statusLabel(RideStatus status) {
    switch (status) {
      case RideStatus.confirmed:
        return 'Confirmée';
      case RideStatus.cancelled:
        return 'Annulée';
      case RideStatus.ended:
        return 'Terminée';
      default:
        return status.name;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final statusColor = _statusColor(ride.status);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colorScheme.outlineVariant),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  ride.createdAt != null
                      ? '${ride.createdAt.day}/${ride.createdAt.month}/${ride.createdAt.year}'
                      : '—',
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: colorScheme.onSurfaceVariant),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _statusLabel(ride.status),
                    style: TextStyle(
                      fontSize: 11,
                      color: statusColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.circle_rounded,
                    size: 10, color: Colors.green),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Départ',
                    style: theme.textTheme.bodySmall,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_rounded,
                    size: 10, color: VoyajColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Arrivée',
                    style: theme.textTheme.bodySmall,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            ...[
            const SizedBox(height: 8),
            Text(
              '${ride.priceBreakdown.passengerShareEur.toStringAsFixed(2)} €',
              style: theme.textTheme.labelMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
          ],
          ],
        ),
      ),
    );
  }
}
