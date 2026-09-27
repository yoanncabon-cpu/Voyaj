import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../shared/theme/app_theme.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigate();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(milliseconds: 1800));
    if (!mounted) return;

    final authState = ref.read(authStateProvider);
    authState.whenData((user) {
      if (user != null) {
        context.go(AppConstants.routeDriverHome);
      } else {
        context.go(AppConstants.routeOnboarding);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VoyajColors.primary,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(
                Icons.directions_car_rounded,
                size: 60,
                color: VoyajColors.primary,
              ),
            )
                .animate()
                .fadeIn(duration: 600.ms)
                .scale(
                    begin: const Offset(0.7, 0.7),
                    curve: Curves.easeOutBack),
            const SizedBox(height: 24),
            Text(
              'Voyaj',
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
            )
                .animate(delay: 300.ms)
                .fadeIn(duration: 500.ms)
                .slideY(begin: 0.3, curve: Curves.easeOut),
            const SizedBox(height: 8),
            Text(
              'Partage de route, partage de vie.',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.white.withOpacity(0.8)),
            ).animate(delay: 500.ms).fadeIn(duration: 500.ms),
            const SizedBox(height: 60),
            const CircularProgressIndicator(
              color: Colors.white,
              strokeWidth: 2,
            ).animate(delay: 800.ms).fadeIn(duration: 300.ms),
          ],
        ),
      ),
    );
  }
}
