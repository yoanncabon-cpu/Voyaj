import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';
import '../../data/repositories/user_repository.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final userAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mon profil'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push(AppConstants.routeSettings),
          ),
        ],
      ),
      body: userAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur : $e')),
        data: (user) {
          if (user == null) {
            return const Center(child: Text('Profil introuvable'));
          }

          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              // ── Avatar + nom ───────────────────────────────────────────
              Center(
                child: Column(
                  children: [
                    GestureDetector(
                      onTap: () {}, // TODO: changer photo
                      child: Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          CircleAvatar(
                            radius: 52,
                            backgroundImage: user.photoUrl != null
                                ? NetworkImage(user.photoUrl!)
                                : null,
                            backgroundColor: colorScheme.surfaceContainerHighest,
                            child: user.photoUrl == null
                                ? Text(
                                    user.firstName.isNotEmpty
                                        ? user.firstName[0].toUpperCase()
                                        : '?',
                                    style: theme.textTheme.headlineMedium
                                        ?.copyWith(
                                            color: colorScheme.onSurfaceVariant),
                                  )
                                : null,
                          ),
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: VoyajColors.primary,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: colorScheme.surface,
                                width: 2,
                              ),
                            ),
                            child: const Icon(Icons.camera_alt_rounded,
                                size: 14, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      user.firstName,
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    if (user.ratingCount > 0) ...[
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.star_rounded,
                              size: 16, color: Colors.amber),
                          const SizedBox(width: 4),
                          Text(
                            '${user.rating.toStringAsFixed(1)} (${user.ratingCount} avis)',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ).animate().fadeIn(duration: 300.ms),

              const SizedBox(height: 32),

              // ── Vérification ──────────────────────────────────────────
              if (!user.isVerified) ...[
                _VerificationBanner(
                  verificationStatus: user.verificationStatus.name,
                  onTap: () => context.push(AppConstants.routeVerification),
                ),
                const SizedBox(height: 20),
              ],

              // ── Stats ─────────────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.star_outline_rounded,
                      value: '${user.pointsBalance}',
                      label: 'Points',
                      color: VoyajColors.tertiary,
                      onTap: () => context.push(AppConstants.routePoints),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.history_rounded,
                      value: '—',
                      label: 'Trajets',
                      color: VoyajColors.secondary,
                      onTap: () => context.push(AppConstants.routeHistory),
                    ),
                  ),
                ],
              ).animate().fadeIn(delay: 100.ms, duration: 300.ms),

              const SizedBox(height: 24),

              // ── Section : Mode chauffeur ──────────────────────────────
              const _SectionTitle(title: 'Chauffeur'),
              _MenuTile(
                icon: Icons.directions_car_outlined,
                title: 'Mon véhicule',
                onTap: () => context.push(AppConstants.routeVehicle),
              ),
              _MenuTile(
                icon: Icons.verified_outlined,
                title: 'Vérification d\'identité',
                trailing: _verificationChip(context, user.isVerified,
                    user.verificationStatus.name),
                onTap: () => context.push(AppConstants.routeVerification),
              ),
              _MenuTile(
                icon: Icons.account_balance_wallet_outlined,
                title: 'Paiements & virements',
                onTap: () => context.push(AppConstants.routePayment),
              ),

              const SizedBox(height: 16),

              // ── Section : Compte ──────────────────────────────────────
              const _SectionTitle(title: 'Compte'),
              _MenuTile(
                icon: Icons.history_rounded,
                title: 'Historique des trajets',
                onTap: () => context.push(AppConstants.routeHistory),
              ),
              _MenuTile(
                icon: Icons.star_outline_rounded,
                title: 'Mes points & récompenses',
                onTap: () => context.push(AppConstants.routePoints),
              ),
              _MenuTile(
                icon: Icons.settings_outlined,
                title: 'Paramètres',
                onTap: () => context.push(AppConstants.routeSettings),
              ),

              const SizedBox(height: 16),

              // ── Déconnexion ───────────────────────────────────────────
              OutlinedButton.icon(
                onPressed: () async {
                  await FirebaseAuth.instance.signOut();
                  if (context.mounted) {
                    context.go(AppConstants.routeAuthChoice);
                  }
                },
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Se déconnecter'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: colorScheme.error,
                  side: BorderSide(color: colorScheme.error),
                  minimumSize: const Size.fromHeight(48),
                ),
              ),

              const SizedBox(height: 40),
            ],
          );
        },
      ),
    );
  }

  Widget _verificationChip(
      BuildContext context, bool isVerified, String status) {
    final colorScheme = Theme.of(context).colorScheme;
    if (isVerified) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.green.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Text('Vérifié',
            style: TextStyle(fontSize: 12, color: Colors.green)),
      );
    }
    if (status == 'pending') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.orange.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Text('En attente',
            style: TextStyle(fontSize: 12, color: Colors.orange)),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text('Non vérifié',
          style: TextStyle(fontSize: 12, color: colorScheme.onErrorContainer)),
    );
  }
}

class _VerificationBanner extends StatelessWidget {
  final String verificationStatus;
  final VoidCallback onTap;

  const _VerificationBanner({
    required this.verificationStatus,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isPending = verificationStatus == 'pending';
    final color = isPending ? Colors.orange : theme.colorScheme.primary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Icon(
              isPending
                  ? Icons.hourglass_empty_rounded
                  : Icons.info_outline_rounded,
              color: color,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isPending
                        ? 'Vérification en cours'
                        : 'Vérification requise',
                    style: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                  Text(
                    isPending
                        ? 'Votre identité est en cours de vérification.'
                        : 'Vérifiez votre identité pour conduire.',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            if (!isPending)
              Icon(Icons.arrow_forward_ios_rounded, size: 14, color: color),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  const _SectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              letterSpacing: 1.2,
            ),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget? trailing;
  final VoidCallback onTap;

  const _MenuTile({
    required this.icon,
    required this.title,
    this.trailing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      trailing: trailing ?? const Icon(Icons.arrow_forward_ios_rounded, size: 14),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(
              value,
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.bold, color: color),
            ),
            Text(label, style: theme.textTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}
