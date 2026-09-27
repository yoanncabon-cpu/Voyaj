import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';
import '../../data/models/ride_model.dart';
import '../../data/repositories/ride_repository.dart';
import '../providers/ride_provider.dart';

/// Écran de navigation du chauffeur pendant la course.
/// Mapbox sera intégré ici pour afficher le trajet en temps réel.
class DriverNavigationScreen extends ConsumerStatefulWidget {
  final String rideId;
  const DriverNavigationScreen({super.key, required this.rideId});

  @override
  ConsumerState<DriverNavigationScreen> createState() =>
      _DriverNavigationScreenState();
}

class _DriverNavigationScreenState
    extends ConsumerState<DriverNavigationScreen> {
  bool _loading = false;

  Future<void> _updateStatus(String action, {String? pickupCode}) async {
    setState(() => _loading = true);
    try {
      await ref.read(rideRepositoryProvider).updateRideStatus(
            rideId: widget.rideId,
            action: action,
            pickupCode: pickupCode,
          );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final rideAsync = ref.watch(rideStreamProvider(widget.rideId));

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

          // Auto-navigate to summary when ride ends
          if (ride.status == RideStatus.confirmed ||
              ride.status == RideStatus.ended) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                context.go('/driver/summary/${widget.rideId}');
              }
            });
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
                      Icon(Icons.navigation_rounded,
                          size: 64, color: colorScheme.onSurfaceVariant),
                      const SizedBox(height: 8),
                      Text(
                        'Navigation Mapbox',
                        style: theme.textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Barre d'info haute ─────────────────────────────────────
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  child: _TopInfoBar(ride: ride),
                ),
              ),

              // ── Panel d'actions bas ────────────────────────────────────
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _DriverActionPanel(
                  ride: ride,
                  loading: _loading,
                  onAction: _updateStatus,
                ).animate().slideY(
                    begin: 1, end: 0, duration: 400.ms, curve: Curves.easeOut),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ── Barre d'informations en haut ─────────────────────────────────────────────
class _TopInfoBar extends StatelessWidget {
  final RideModel ride;
  const _TopInfoBar({required this.ride});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    String statusText;
    Color statusColor;
    switch (ride.status) {
      case RideStatus.accepted:
        statusText = 'En route vers le passager';
        statusColor = VoyajColors.primary;
        break;
      case RideStatus.pickup:
        statusText = 'Passager à bord ?';
        statusColor = Colors.orange;
        break;
      case RideStatus.in_progress:
        statusText = 'Course en cours';
        statusColor = Colors.green;
        break;
      default:
        statusText = ride.status.name;
        statusColor = colorScheme.onSurface;
    }

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: statusColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            statusText,
            style:
                theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

// ── Panel d'actions chauffeur ─────────────────────────────────────────────────
class _DriverActionPanel extends StatefulWidget {
  final RideModel ride;
  final bool loading;
  final Future<void> Function(String action, {String? pickupCode}) onAction;

  const _DriverActionPanel({
    required this.ride,
    required this.loading,
    required this.onAction,
  });

  @override
  State<_DriverActionPanel> createState() => _DriverActionPanelState();
}

class _DriverActionPanelState extends State<_DriverActionPanel> {
  final _codeCtrl = TextEditingController();

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
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
          const SizedBox(height: 20),

          if (widget.ride.status == RideStatus.accepted) ...[
            // Bouton : Je suis arrivé
            FilledButton(
              onPressed: widget.loading
                  ? null
                  : () => widget.onAction('arrive'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: VoyajColors.primary,
              ),
              child: widget.loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Je suis arrivé au point de départ',
                      style: TextStyle(fontSize: 15)),
            ),
          ] else if (widget.ride.status == RideStatus.pickup) ...[
            // Champ code de prise en charge
            TextField(
              controller: _codeCtrl,
              keyboardType: TextInputType.number,
              maxLength: AppConstants.pickupCodeLength,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: 12,
              ),
              decoration: InputDecoration(
                hintText: '— — — —',
                counterText: '',
                label: const Text('Code passager'),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: widget.loading
                  ? null
                  : () => widget.onAction('start', pickupCode: _codeCtrl.text),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: Colors.green,
              ),
              child: widget.loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Démarrer la course',
                      style: TextStyle(fontSize: 15)),
            ),
          ] else if (widget.ride.status == RideStatus.in_progress) ...[
            // Bouton : Terminer la course
            FilledButton(
              onPressed: widget.loading
                  ? null
                  : () => widget.onAction('end'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: Colors.orange,
              ),
              child: widget.loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Fin de course',
                      style: TextStyle(fontSize: 15)),
            ),
          ],
        ],
      ),
    );
  }
}
