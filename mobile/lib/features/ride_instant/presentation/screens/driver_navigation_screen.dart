import 'package:flutter/material.dart';

class DriverNavigationScreen extends StatelessWidget {
  const DriverNavigationScreen({super.key, required this.rideId});
  final String rideId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('DriverNavigationScreen')), body: const Center(child: Text('TODO')));
  }
}
