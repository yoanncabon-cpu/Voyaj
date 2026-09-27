import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';
import '../../data/repositories/ride_repository.dart';
import '../providers/ride_provider.dart';

/// Écran affiché au chauffeur quand une demande de course arrive.
/// Il a 90 secondes pour accepter ou refuser.
class RideRequestScreen extends ConsumerStatefulWidget {
  final String rideId;
  const RideRequestScreen({super.key, required this.rideId});

  @override
  ConsumerState<RideRequestScreen> createState() => _RideRequestScreenState();
}

class _RideRequestScreenState extends ConsumerState<RideRequestScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _timerController;
  bool _accepting = false;
  final bool _refusing = false;

  @override
  void initState() {
    super.initState();
    _timerController = AnimationController(
      vsync: this,
      duration: AppConstants.acceptanceTimeout,
    )..forward();

    _timerController.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        // Timeout — fermer l'écran
        context.pop();
      }
    });
  }

  @override
  void dispose() {
    _timerController.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    setState(() => _accepting = true);
    try {
      await ref
          .read(rideRepositoryProvider)
          .acceptRide(widget.rideId);
      if (mounted) {
        context.go('/driver/navigation/${widget.rideId}');
      }
    } catch (e) {
      setState(() => _accepting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e')),
        );
      }
    }
  }

  void _refuse() {
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final rideAsync = ref.watch(rideStreamProvider(widget.rideId));

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: SafeArea(
        child: rideAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Erreur : $e')),
          data: (ride) {
            if (ride == null) {
              return const Center(child: Text('Course introuvable'));
            }

            return Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  // ── Timer ───────────────────────────────────────────
                  AnimatedBuilder(
                    animation: _timerController,
                    builder: (context, _) {
                      final remaining = AppConstants.acceptanceTimeout.inSeconds *
                          (1 - _timerController.value);
                      return Column(
                        children: [
                          Text(
                            '${remaining.ceil()}s',
                            style: theme.textTheme.headlineLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: remaining < 20
                                  ? colorScheme.error
                                  : colorScheme.primary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          LinearProgressIndicator(
                            value: 1 - _timerController.value,
                            backgroundColor: colorScheme.surfaceContainerHighest,
                            color: remaining < 20
                                ? colorScheme.error
                                : colorScheme.primary,
                          ),
                        ],
                      );
                    },
                  ),

                  const SizedBox(height: 32),

                  // ── Titre ────────────────────────────────────────────
                  Text(
                    'Nouvelle demande de course',
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ).animate().fadeIn(duration: 200.ms),

                  const SizedBox(height: 24),

                  // ── Détails du trajet ─────────────────────────────────
                  _RideDetailCard(
                    pickup: 'Position du passager',
                    dropoff: 'Destination',
                    distance: '—',
                    price: ride.priceBreakdown != null
                        ? '${ride.priceBreakdown.driverEarningsEur.toStringAsFixed(2)} €'
                        : '—',
                  ).animate().fadeIn(delay: 100.ms, duration: 200.ms),

                  const Spacer(),

                  // ── Boutons ───────────────────────────────────────────
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _refusing ? null : _refuse,
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(56),
                            foregroundColor: colorScheme.error,
                            side: BorderSide(color: colorScheme.error),
                          ),
                          child: const Text('Refuser'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        flex: 2,
                        child: FilledButton(
                          onPressed: _accepting ? null : _accept,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(56),
                            backgroundColor: VoyajColors.primary,
                          ),
                          child: _accepting
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Accepter',
                                  style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold),
                                ),
                        ),
                      ),
                    ],
                  ).animate().fadeIn(delay: 200.ms, duration: 200.ms),

                  const SizedBox(height: 16),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RideDetailCard extends StatelessWidget {
  final String pickup;
  final String dropoff;
  final String distance;
  final String price;

  const _RideDetailCard({
    required this.pickup,
    required this.dropoff,
    required this.distance,
    required this.price,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        children: [
          _AddressRow(
            icon: Icons.circle_rounded,
            iconColor: Colors.green,
            label: 'Départ',
            address: pickup,
          ),
          const Padding(
            padding: EdgeInsets.only(left: 10),
            child: SizedBox(
              height: 24,
              child: VerticalDivider(width: 1),
            ),
          ),
          _AddressRow(
            icon: Icons.location_on_rounded,
            iconColor: VoyajColors.primary,
            label: 'Arrivée',
            address: dropoff,
          ),
          const Divider(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _InfoBadge(
                  icon: Icons.straighten_rounded, label: distance, hint: 'km'),
              _InfoBadge(
                icon: Icons.euro_rounded,
                label: price,
                hint: 'gagné',
                highlight: true,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AddressRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String address;

  const _AddressRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.address,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, color: iconColor, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant)),
              Text(address,
                  style:
                      theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ],
    );
  }
}

class _InfoBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  final String hint;
  final bool highlight;

  const _InfoBadge({
    required this.icon,
    required this.label,
    required this.hint,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color =
        highlight ? VoyajColors.primary : theme.colorScheme.onSurfaceVariant;

    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: color,
                )),
            Text(hint,
                style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
          ],
        ),
      ],
    );
  }
}
