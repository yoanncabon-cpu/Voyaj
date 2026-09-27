import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../constants/app_constants.dart';

class HomeScaffold extends StatelessWidget {
  const HomeScaffold({super.key, required this.child});

  final Widget child;

  int _locationIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith(AppConstants.routeMessages)) return 1;
    if (location.startsWith(AppConstants.routeEvents)) return 2;
    if (location.startsWith(AppConstants.routeProfile)) return 3;
    return 0; // driver home ou passenger home
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _locationIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go(AppConstants.routeDriverHome);
            case 1:
              context.go(AppConstants.routeMessages);
            case 2:
              context.go(AppConstants.routeEvents);
            case 3:
              context.go(AppConstants.routeProfile);
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Accueil',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline_rounded),
            selectedIcon: Icon(Icons.chat_bubble_rounded),
            label: 'Messages',
          ),
          NavigationDestination(
            icon: Icon(Icons.event_outlined),
            selectedIcon: Icon(Icons.event_rounded),
            label: 'Événements',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
