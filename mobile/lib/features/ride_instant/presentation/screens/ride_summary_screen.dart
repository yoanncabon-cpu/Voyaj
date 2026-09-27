import 'package:flutter/material.dart';

class RideSummaryScreen extends StatelessWidget {
  const RideSummaryScreen({super.key, required this.rideId});
  final String rideId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('RideSummaryScreen')), body: const Center(child: Text('TODO')));
  }
}
