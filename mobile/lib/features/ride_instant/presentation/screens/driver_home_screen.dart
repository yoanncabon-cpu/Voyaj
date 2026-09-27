import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';
import '../../../profile/data/repositories/user_repository.dart';

class DriverHomeScreen extends ConsumerWidget {
  const DriverHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final userAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Header ──────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: userAsync.when(
                        data: (user) => Text(
                          'Bonjour ${user?.firstName ?? ''} 👋',
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        loading: () => const SizedBox(),
                        error: (_, __) => const SizedBox(),
                      ),
                    ),
                    // Bouton notifications
                    IconButton(
                      icon: const Icon(Icons.notifications_outlined),
                      onPressed: () {},
                    ),
                  ],
                ),
              ),
            ),

            // ── Mode actif / inactif ─────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: _DriverModeCard(theme: theme, colorScheme: colorScheme),
              ),
            ),

            // ── Actions rapides ──────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              sliver: SliverGrid.count(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.4,
                children: [
                  _QuickAction(
                    icon: Icons.route_rounded,
                    label: 'Publier un trajet',
                    color: VoyajColors.primary,
                    onTap: () => context.push(AppConstants.routePublishRide),
                  ),
                  _QuickAction(
                    icon: Icons.history_rounded,
                    label: 'Historique',
                    color: VoyajColors.secondary,
                    onTap: () => context.push(AppConstants.routeHistory),
                  ),
                  _QuickAction(
                    icon: Icons.star_outline_rounded,
                    label: 'Mes points',
                    color: VoyajColors.tertiary,
                    onTap: () => context.push(AppConstants.routePoints),
                  ),
                  _QuickAction(
                    icon: Icons.security_rounded,
                    label: 'Je suis rentré',
                    color: Colors.orange,
                    onTap: () => context.push(AppConstants.routeSafeReturn),
                  ),
                ],
              ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}

class _DriverModeCard extends StatefulWidget {
  final ThemeData theme;
  final ColorScheme colorScheme;

  const _DriverModeCard({
    required this.theme,
    required this.colorScheme,
  });

  @override
  State<_DriverModeCard> createState() => _DriverModeCardState();
}

class _DriverModeCardState extends State<_DriverModeCard> {
  bool _isOnline = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: 400.ms,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: _isOnline
              ? [VoyajColors.primary, VoyajColors.primary.withOpacity(0.7)]
              : [
                  widget.colorScheme.surfaceContainerHighest,
                  widget.colorScheme.surfaceContainerHighest,
                ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _isOnline ? 'En ligne' : 'Hors ligne',
                  style: widget.theme.textTheme.titleMedium?.copyWith(
                    color: _isOnline
                        ? Colors.white
                        : widget.colorScheme.onSurface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _isOnline
                      ? 'Vous êtes visible des passagers'
                      : 'Activez pour recevoir des courses',
                  style: widget.theme.textTheme.bodySmall?.copyWith(
                    color: _isOnline
                        ? Colors.white.withOpacity(0.8)
                        : widget.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: _isOnline,
            onChanged: (v) => setState(() => _isOnline = v),
            activeColor: Colors.white,
            activeTrackColor: Colors.white.withOpacity(0.4),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(
              color: theme.colorScheme.outlineVariant,
              width: 1,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 8),
              Text(
                label,
                style: theme.textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 300.ms)
        .scale(begin: const Offset(0.95, 0.95));
  }
}
