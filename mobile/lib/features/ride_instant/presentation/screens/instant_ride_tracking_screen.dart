import 'package:flutter/material.dart';

class InstantRideTrackingScreen extends StatelessWidget {
  const InstantRideTrackingScreen({super.key, this.rideId});
  final String? rideId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Course')), body: const Center(child: Text('TODO')));
  }
}
