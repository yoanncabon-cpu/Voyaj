import 'package:flutter/material.dart';

class RideRequestScreen extends StatelessWidget {
  const RideRequestScreen({super.key, required this.rideId});
  final String rideId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('RideRequestScreen')), body: const Center(child: Text('TODO')));
  }
}
