import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/app_theme.dart';
import '../../../profile/data/repositories/user_repository.dart';

class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final userAsync = ref.watch(currentUserProfileProvider);
    final points = userAsync.valueOrNull?.pointsBalance ?? 0;

    final rewards = [
      const _Reward(
          id: 'free_ride',
          title: '1 course offerte',
          cost: 200,
          icon: Icons.car_rental_rounded),
      const _Reward(
          id: 'premium_badge',
          title: 'Badge Premium',
          cost: 100,
          icon: Icons.verified_rounded),
      const _Reward(
          id: 'discount_10',
          title: 'Réduction 10%',
          cost: 50,
          icon: Icons.discount_rounded),
      const _Reward(
          id: 'fuel_voucher_5',
          title: 'Bon carburant 5€',
          cost: 150,
          icon: Icons.local_gas_station_rounded),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Récompenses')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Solde
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: VoyajColors.tertiary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: VoyajColors.tertiary.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.star_rounded,
                    color: VoyajColors.tertiary, size: 28),
                const SizedBox(width: 12),
                Text(
                  '$points points disponibles',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: VoyajColors.tertiary,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          Text('Catalogue',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate:
                const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.1,
            ),
            itemCount: rewards.length,
            itemBuilder: (context, i) {
              final r = rewards[i];
              final canAfford = points >= r.cost;

              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: canAfford
                      ? VoyajColors.tertiary.withOpacity(0.05)
                      : colorScheme.surfaceContainerHighest.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: canAfford
                        ? VoyajColors.tertiary.withOpacity(0.3)
                        : colorScheme.outlineVariant,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Icon(r.icon,
                        color: canAfford
                            ? VoyajColors.tertiary
                            : colorScheme.onSurfaceVariant,
                        size: 28),
                    Text(r.title,
                        style: theme.textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.bold)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${r.cost} pts',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: canAfford
                                ? VoyajColors.tertiary
                                : colorScheme.onSurfaceVariant,
                            fontSize: 13,
                          ),
                        ),
                        if (canAfford)
                          GestureDetector(
                            onTap: () async {
                              try {
                                final fn = FirebaseFunctions.instanceFor(
                                        region: 'europe-west1')
                                    .httpsCallable('redeemPoints');
                                final result =
                                    await fn.call({'rewardId': r.id});
                                final code =
                                    result.data['redemptionCode'] as String?;
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                        content: Text(
                                            'Récompense obtenue${code != null ? ' — Code : $code' : ''}')),
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Erreur : $e')),
                                  );
                                }
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: VoyajColors.tertiary,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text('Échanger',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold)),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _Reward {
  final String id;
  final String title;
  final int cost;
  final IconData icon;

  const _Reward({
    required this.id,
    required this.title,
    required this.cost,
    required this.icon,
  });
}
