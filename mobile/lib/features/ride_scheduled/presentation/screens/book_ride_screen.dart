import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';

/// Écran de réservation d'un trajet programmé.
/// Affiche les détails du trajet, le prix, et permet de payer.
class BookRideScreen extends ConsumerStatefulWidget {
  final String rideId;
  const BookRideScreen({super.key, required this.rideId});

  @override
  ConsumerState<BookRideScreen> createState() => _BookRideScreenState();
}

class _BookRideScreenState extends ConsumerState<BookRideScreen> {
  bool _loading = false;
  int _seats = 1;

  Future<void> _book(Map<String, dynamic> rideData) async {
    setState(() => _loading = true);
    try {
      // Note: en prod, un vrai PaymentSheet Stripe serait présenté ici.
      // Pour le MVP, on utilise un payment method test.
      final fn = FirebaseFunctions.instanceFor(region: 'europe-west1')
          .httpsCallable('bookScheduledRide');
      final result = await fn.call({
        'rideId': widget.rideId,
        'seats': _seats,
        'paymentMethodId': 'pm_card_visa', // TODO(stripe): PaymentSheet (pm_card_visa = carte de test Stripe)
      });
      final bookingId = result.data['bookingId'] as String?;
      if (mounted && bookingId != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Réservation confirmée !')),
        );
        context.go(AppConstants.routePassengerHome);
      }
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Réserver le trajet')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('scheduled_rides')
            .doc(widget.rideId)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snapshot.hasData || !snapshot.data!.exists) {
            return const Center(child: Text('Trajet introuvable'));
          }

          final ride = snapshot.data!.data()!;
          final priceBreakdown = ride['priceBreakdown'] as Map<String, dynamic>?;
          final passengerTotal =
              (priceBreakdown?['passengerTotalEur'] as num?)?.toDouble() ?? 0.0;
          final availableSeats =
              (ride['seats'] as int? ?? 0) - (ride['bookedSeats'] as int? ?? 0);

          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Détails du trajet ──────────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainerHighest.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: colorScheme.outlineVariant),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _AddressRow(
                        icon: Icons.circle_rounded,
                        iconColor: Colors.green,
                        label: ride['originAddress'] ?? 'Départ',
                      ),
                      const SizedBox(height: 8),
                      _AddressRow(
                        icon: Icons.location_on_rounded,
                        iconColor: VoyajColors.primary,
                        label: ride['destinationAddress'] ?? 'Destination',
                      ),
                      const Divider(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${passengerTotal.toStringAsFixed(2)} € / place',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: VoyajColors.primary,
                            ),
                          ),
                          Text(
                            '$availableSeats place(s) dispo',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // ── Nombre de places ───────────────────────────────────────
                Row(
                  children: [
                    Text('Places', style: theme.textTheme.labelLarge),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.remove_circle_outline_rounded),
                      onPressed: _seats > 1
                          ? () => setState(() => _seats--)
                          : null,
                    ),
                    Text('$_seats',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline_rounded),
                      onPressed: _seats < availableSeats
                          ? () => setState(() => _seats++)
                          : null,
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // ── Récapitulatif prix ─────────────────────────────────────
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: VoyajColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Total', style: theme.textTheme.bodyLarge),
                      Text(
                        '${(passengerTotal * _seats).toStringAsFixed(2)} €',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: VoyajColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),

                const Spacer(),

                FilledButton(
                  onPressed:
                      _loading || availableSeats == 0 ? null : () => _book(ride),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(56),
                    backgroundColor: VoyajColors.primary,
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Confirmer et payer',
                          style: TextStyle(fontSize: 16)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AddressRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;

  const _AddressRow({
    required this.icon,
    required this.iconColor,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 12, color: iconColor),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
