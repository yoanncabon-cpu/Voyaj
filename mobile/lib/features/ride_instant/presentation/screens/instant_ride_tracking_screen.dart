import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/theme/app_theme.dart';
import '../../data/models/ride_model.dart';
import '../../data/repositories/ride_repository.dart';
import '../providers/ride_provider.dart';

/// Écran de suivi en temps réel pour le passager.
/// Géré par null rideId = écran de demande de course initiale,
/// ou rideId non-null = suivi d'une course en cours.
class InstantRideTrackingScreen extends ConsumerStatefulWidget {
  final String? rideId;
  const InstantRideTrackingScreen({super.key, this.rideId});

  @override
  ConsumerState<InstantRideTrackingScreen> createState() =>
      _InstantRideTrackingScreenState();
}

class _InstantRideTrackingScreenState
    extends ConsumerState<InstantRideTrackingScreen> {
  final _destinationCtrl = TextEditingController();
  bool _requesting = false;

  @override
  void dispose() {
    _destinationCtrl.dispose();
    super.dispose();
  }

  Future<void> _requestRide() async {
    if (_destinationCtrl.text.trim().isEmpty) return;
    setState(() => _requesting = true);

    try {
      final result = await ref.read(rideRepositoryProvider).requestRide(
            // TODO(mapbox): position GPS réelle + géocodage de la destination
            pickupLat: 48.8566,
            pickupLng: 2.3522,
            pickupAddress: 'Position actuelle',
            destinationLat: 48.8700,
            destinationLng: 2.3600,
            destinationAddress: _destinationCtrl.text.trim(),
            distanceKm: 2.0,
            // TODO(stripe): PaymentSheet
            paymentMethodId: 'pm_card_visa',
          );
      final rideId = result['rideId'] as String;
      if (mounted) {
        context.go('/passenger/instant/$rideId');
      }
    } catch (e) {
      setState(() => _requesting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rideId == null) {
      return _RideRequestForm(
        destinationCtrl: _destinationCtrl,
        requesting: _requesting,
        onRequest: _requestRide,
      );
    }
    return _RideTrackingView(rideId: widget.rideId!);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Formulaire de demande de course (avant rideId)
// ──────────────────────────────────────────────────────────────────────────────
class _RideRequestForm extends StatelessWidget {
  final TextEditingController destinationCtrl;
  final bool requesting;
  final VoidCallback onRequest;

  const _RideRequestForm({
    required this.destinationCtrl,
    required this.requesting,
    required this.onRequest,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Course immédiate')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Carte placeholder
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.map_outlined,
                          size: 48, color: colorScheme.onSurfaceVariant),
                      const SizedBox(height: 8),
                      Text('Position actuelle',
                          style: theme.textTheme.bodyMedium?.copyWith(
                              color: colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Champ destination
            TextField(
              controller: destinationCtrl,
              decoration: InputDecoration(
                labelText: 'Où allez-vous ?',
                prefixIcon: const Icon(Icons.location_on_outlined),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),

            const SizedBox(height: 16),

            FilledButton(
              onPressed: requesting ? null : onRequest,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: VoyajColors.primary,
              ),
              child: requesting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Trouver un chauffeur',
                      style: TextStyle(fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Suivi de course en cours
// ──────────────────────────────────────────────────────────────────────────────
class _RideTrackingView extends ConsumerWidget {
  final String rideId;
  const _RideTrackingView({required this.rideId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final rideAsync = ref.watch(rideStreamProvider(rideId));

    return Scaffold(
      body: rideAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Scaffold(
          appBar: AppBar(),
          body: Center(child: Text('Erreur : $e')),
        ),
        data: (ride) {
          if (ride == null) {
            return Scaffold(
              appBar: AppBar(),
              body: const Center(child: Text('Course introuvable')),
            );
          }

          return Stack(
            children: [
              // ── Carte placeholder ──────────────────────────────────────
              Container(
                color: colorScheme.surfaceContainerHighest,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.map_outlined,
                          size: 64, color: colorScheme.onSurfaceVariant),
                      const SizedBox(height: 8),
                      Text('Carte en temps réel (Mapbox)',
                          style: theme.textTheme.bodyMedium?.copyWith(
                              color: colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              ),

              // ── Panel d'état en bas ────────────────────────────────────
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _RideStatusPanel(ride: ride).animate().slideY(
                    begin: 1, end: 0, duration: 400.ms, curve: Curves.easeOut),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RideStatusPanel extends ConsumerWidget {
  final RideModel ride;
  const _RideStatusPanel({required this.ride});

  String _statusLabel(RideStatus status) {
    switch (status) {
      case RideStatus.searching:
        return 'Recherche d\'un chauffeur…';
      case RideStatus.accepted:
        return 'Chauffeur en route';
      case RideStatus.pickup:
        return 'Chauffeur arrivé';
      case RideStatus.in_progress:
        return 'En course';
      case RideStatus.ended:
        return 'Course terminée';
      case RideStatus.confirmed:
        return 'Course confirmée';
      case RideStatus.cancelled:
        return 'Course annulée';
      default:
        return status.name;
    }
  }

  Color _statusColor(RideStatus status) {
    switch (status) {
      case RideStatus.searching:
        return Colors.orange;
      case RideStatus.accepted:
      case RideStatus.pickup:
        return VoyajColors.primary;
      case RideStatus.in_progress:
        return Colors.green;
      case RideStatus.ended:
      case RideStatus.confirmed:
        return Colors.green;
      case RideStatus.cancelled:
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final statusColor = _statusColor(ride.status);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: colorScheme.outlineVariant,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Statut
          Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: statusColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _statusLabel(ride.status),
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Info conducteur (si acceptée)
          if (ride.status != RideStatus.searching &&
              ride.status != RideStatus.cancelled) ...[
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: colorScheme.surfaceContainerHighest,
                  child: const Icon(Icons.person_rounded),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ride.driverName ?? 'Chauffeur',
                        style: theme.textTheme.labelLarge
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        ride.vehicleDescription ?? '',
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                if (ride.pickupCode != null &&
                    ride.status == RideStatus.pickup) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: VoyajColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: VoyajColors.primary.withOpacity(0.4)),
                    ),
                    child: Text(
                      ride.pickupCode!,
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: VoyajColors.primary,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 4,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),
          ],

          // Bouton annuler (si en recherche)
          if (ride.status == RideStatus.searching) ...[
            OutlinedButton(
              onPressed: () async {
                try {
                  await ref.read(rideRepositoryProvider).updateRideStatus(
                        rideId: ride.rideId,
                        action: 'cancel',
                      );
                  if (context.mounted) context.pop();
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Erreur : $e')),
                    );
                  }
                }
              },
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                foregroundColor: colorScheme.error,
                side: BorderSide(color: colorScheme.error),
              ),
              child: const Text('Annuler la demande'),
            ),
          ],

          // Bouton confirmer (si terminée)
          if (ride.status == RideStatus.ended) ...[
            FilledButton(
              onPressed: () async {
                try {
                  await ref.read(rideRepositoryProvider).updateRideStatus(
                        rideId: ride.rideId,
                        action: 'confirm',
                      );
                  if (context.mounted) {
                    context.go('/driver/summary/${ride.rideId}');
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Erreur : $e')),
                    );
                  }
                }
              },
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                backgroundColor: Colors.green,
              ),
              child: const Text('Confirmer l\'arrivée'),
            ),
          ],
        ],
      ),
    );
  }
}
