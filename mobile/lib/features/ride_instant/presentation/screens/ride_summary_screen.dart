import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';
import '../providers/ride_provider.dart';

/// Écran de résumé de course + notation.
/// Affiché après la fin d'une course (passager ou chauffeur).
class RideSummaryScreen extends ConsumerStatefulWidget {
  final String rideId;
  const RideSummaryScreen({super.key, required this.rideId});

  @override
  ConsumerState<RideSummaryScreen> createState() => _RideSummaryScreenState();
}

class _RideSummaryScreenState extends ConsumerState<RideSummaryScreen> {
  int _rating = 0;
  bool _submitting = false;

  Future<void> _submitRating() async {
    if (_rating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez choisir une note')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final fn = FirebaseFunctions.instanceFor(region: 'europe-west1')
          .httpsCallable('submitRating');
      await fn.call({'rideId': widget.rideId, 'rating': _rating});
      if (mounted) {
        context.go(AppConstants.routeDriverHome);
      }
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final rideAsync = ref.watch(rideStreamProvider(widget.rideId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Résumé de la course'),
        automaticallyImplyLeading: false,
      ),
      body: rideAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur : $e')),
        data: (ride) {
          if (ride == null) {
            return const Center(child: Text('Course introuvable'));
          }

          final priceBreakdown = ride.priceBreakdown;

          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              // ── Succès ───────────────────────────────────────────────
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check_rounded,
                          color: Colors.white, size: 40),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Course terminée !',
                      style: theme.textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ).animate().scale(duration: 400.ms, curve: Curves.elasticOut),

              const SizedBox(height: 32),

              // ── Détail financier ──────────────────────────────────────
              ...[
              _SummaryCard(
                children: [
                  _SummaryRow(
                    label: 'Part par passager',
                    value:
                        '${priceBreakdown.passengerShareEur.toStringAsFixed(2)} €',
                  ),
                  _SummaryRow(
                    label: 'Frais Voyaj',
                    value:
                        '${priceBreakdown.voyajFeeEur.toStringAsFixed(2)} €',
                  ),
                  const Divider(),
                  _SummaryRow(
                    label: 'Reçu (chauffeur)',
                    value:
                        '${priceBreakdown.driverEarningsEur.toStringAsFixed(2)} €',
                    bold: true,
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],

              // ── Notation ──────────────────────────────────────────────
              Text(
                'Comment s\'est passée la course ?',
                style:
                    theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (index) {
                  return IconButton(
                    icon: Icon(
                      index < _rating ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: Colors.amber,
                      size: 40,
                    ),
                    onPressed: () => setState(() => _rating = index + 1),
                  );
                }),
              ).animate().fadeIn(delay: 200.ms, duration: 300.ms),

              const SizedBox(height: 32),

              // ── Bouton ────────────────────────────────────────────────
              FilledButton(
                onPressed: _submitting ? null : _submitRating,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  backgroundColor: VoyajColors.primary,
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Terminer',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
              ),

              const SizedBox(height: 12),

              // Lien litige
              TextButton(
                onPressed: () => context.push('/dispute/${widget.rideId}'),
                child: const Text('Signaler un problème'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final List<Widget> children;
  const _SummaryCard({required this.children});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(children: children),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: bold
                ? theme.textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.bold)
                : theme.textTheme.bodyMedium,
          ),
          Text(
            value,
            style: bold
                ? theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  )
                : theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
