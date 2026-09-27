import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';
import '../../../profile/data/repositories/user_repository.dart';

class PointsScreen extends ConsumerWidget {
  const PointsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final userAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes points'),
        actions: [
          TextButton(
            onPressed: () => context.push(AppConstants.routeRewards),
            child: const Text('Récompenses'),
          ),
        ],
      ),
      body: userAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur : $e')),
        data: (user) {
          final points = user?.pointsBalance ?? 0;
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              // Solde
              Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      VoyajColors.tertiary,
                      VoyajColors.tertiary.withOpacity(0.7)
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.star_rounded,
                        color: Colors.white, size: 36),
                    const SizedBox(height: 12),
                    Text(
                      '$points',
                      style: theme.textTheme.displayMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      'points Voyaj',
                      style: theme.textTheme.bodyLarge
                          ?.copyWith(color: Colors.white.withOpacity(0.85)),
                    ),
                  ],
                ),
              ).animate().fadeIn(duration: 300.ms),

              const SizedBox(height: 32),

              Text(
                'Comment gagner des points ?',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),

              ...[
                ('Course terminée', '+10 pts', Icons.route_rounded),
                ('Avis 5 étoiles reçu', '+5 pts', Icons.star_rounded),
                ('Première course', '+20 pts', Icons.celebration_rounded),
                ('Parrainage accepté', '+50 pts', Icons.group_add_rounded),
              ].map((e) => _PointRow(
                    label: e.$1,
                    value: e.$2,
                    icon: e.$3,
                  )),

              const SizedBox(height: 24),

              OutlinedButton.icon(
                onPressed: () => context.push(AppConstants.routeRewards),
                icon: const Icon(Icons.card_giftcard_rounded),
                label: const Text('Voir les récompenses disponibles'),
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48)),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _PointRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _PointRow({
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: VoyajColors.tertiary.withOpacity(0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: VoyajColors.tertiary, size: 20),
      ),
      title: Text(label),
      trailing: Text(
        value,
        style: theme.textTheme.labelLarge?.copyWith(
          color: VoyajColors.tertiary,
          fontWeight: FontWeight.bold,
        ),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}
